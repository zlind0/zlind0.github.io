# Serverless的博客留言板

很开心，我的博客终于建设好了。它包括了一系列静态网页、Markdown写作的文章，还有一个留言板。这个博客完全搭建在Cloudflare之上。静态网页使用Cloudflare Page的构建功能。留言板使用Cloudflare Worker，留言存储利用的是它提供的KV存储功能。**整个博客完全不需要使用任何云服务器。Worker功能完美地解决了静态网页无法存储数据的问题。**

这是我第一次接触Serverless的概念。这种新的服务搭建方式非常简单易用，可拓展性也很好（给钱就行），同时也不需要踩太多的坑。因此，在这里推荐给大家。

## 静态网页结构

Cloudflare Pages 是一个静态网页服务。它可以自动化从GitHub仓库拉取并构建网页，同时，提供全球的CDN服务。我的博客的视觉效果、网页框架全部由我自己设计，没有使用复杂的框架。需要构建的部分仅为博客的文章列表。文章存储于posts目录之下，按照`年-月-日【空格】标题`的格式存储。

![文章列表的目录结构](./images/2021-05-25_img1.jpg)

构建脚本将目录内容转化为Markdown文档。在首页加载的时候，便会读取这个文档，加载文章列表。

```
<!-- 文章列表，自动生成 -->

- `2021-05-22` 草坪上的一个下午
- `2021-05-21` 新博客开张啦！
- `2021-04-11` 紫金山山顶摄影
- `2021-01-12` Hi there
- `2021-01-01` 2020的一些总结
- `2019-11-11` Multiprocessing in Python
- `2016-11-30` 一点吐槽
- `2016-05-15` 关于Beatles
```

实际运行效果，还是不错滴（

![实际运行效果](./images/2021-05-25_img2.jpg)

转化过程很简单，我写了个Makefile，三个sed就可以搞定啦：

```
postlist.md: posts/* postlist.template.md
	cp postlist.template.md postlist.md
	ls posts|grep \\.md|sort -r|\
        sed "s/\(^[0-9-]*\)/\`\1\`/g;s/^/- /g; s/\.md//g" >> postlist.md
```

## Cloudflare Page构建

接着，就是将这个项目部署到Cloudflare上了。我们进入Cloudflare Page页面

![选择“网页”](./images/2021-05-25_img3.png)

第一步：选择自己的仓库。

![选择自己的GitHub仓库](./images/2021-05-25_img4.jpg)

第二步：选择构建命令，我选择使用make。

![构建命令根据自己需要填写。](./images/2021-05-25_img5.jpg)

然后就部署成功啦。之后需要将自己的域名解析过来：

![域名解析](./images/2021-05-25_img6.jpg)

这样，一个静态网页就搭建好了！

## Serverless的留言板

之前的Cloudflare Pages只是开胃小菜，这个Cloudflare Worker以及KV存储真的让我意识到Cloudflare的威力。Cloudflare Worker是一个可以运行在Cloudflare边缘节点的Node.js程序，可以理解为后端。在留言板中，Worker负责存储与读取KV对。

我们首先创建一个Worker。接着，可以看到Worker的一个简单模版。

```
addEventListener("fetch", (event) => {
  event.respondWith(
    handleRequest(event).catch(
      (err) => new Response(err.stack, { status: 500 })
    )
  );
});

async function handleRequest(event) {
  const { request } = event;
  const { pathname } = new URL(request.url);

  if (pathname.startsWith("/api")) {
      ...
```

这个handelRequest函数就是我们需要实现的函数了，在这个例子中，`/api*`的请求都会进入这个if判断中。

不过先别着急，我们需要先做两件事才能愉快地开始我们的工作。

### 1. 创建并绑定KV存储

首先，我们创建一个KV存储，接着，进入Worker的设置，“KV 命名空间绑定”，绑定刚刚创建的KV存储命名空间。在我的项目里，绑定的变量名为`MYBLOGKV`。

![绑定命名空间为变量名](./images/2021-05-25_img3.jpg)

### 2. 设置Worker的路由

进入域名设置，点击“Worker”，可以将某个路由绑定给指定的Worker。

![设置路由](./images/2021-05-25_img7.jpg)

在这个例子里，我将`blog.olvd.xyz/api/*`的路由绑定给我的Worker，而将`blog.olvd.xyz`绑定至刚刚所说的Cloudflare Pages里。这样做的好处是，当我在`blog.olvd.xyz`的JavaScript代码中写
```
$.ajax({
    url:"api/msg"
    ...
```
这样的代码时，这个请求就可以由Worker来处理。而如果网页和Worker没有绑定在同一个域名下，则由于安全限制，跨域请求就变得麻烦了起来，这里不多展开。

### 用KV存储来制作留言板

完成上面的步骤后，我们就可以愉快地开始码代码啦！

_由Cloudflare的定价策略可知，KV操作中最廉价的操作为读取某个Key对应的Value、10毫秒的Worker工作时间，但是“列出所有Key”、写入（包括替换）、删除都是昂贵的。接下来的设计都基于这个前提假设。_

由于我并不是专业的后台开发人员，只能自己制作一个方便省事的KV存储方案。我的设计是，整个网站分很多留言板房间，`room`。每个房间的留言都由许多的`batch`组成，一个`batch`包括20条留言，因为我希望网页一次加载20条留言。每个房间还有一个索引，Key为`[roomname]-index`，Value为所有的`batch`名称，以json存储，每个`batch`的Key是`[roomname]-batch-[batchname]`，Value是所有的留言，为json编码的字典，`{"time":["author":"content"]}`。Worker就按照这个规则读取、存储留言。主页的聊天室的房间名称为index，文章的评论区的房间名称为文章标题。

最后存储下来的数据大概长这样：

![存储的数据](./images/2021-05-25_img8.jpg)

详细的代码可以来我的仓库看看：[zlind0.github.io](https://github.com/zlind0/zlind0.github.io)

## 定价策略

由于我喜欢白嫖，因此在设计整个项目之前也认真参考了定价策略，了解了整个系统的功能上限。

**免费版Cloudflare Pages：**

1GB存储、每个文件最大25MB，每月最多500次构建。看来就算代码

**免费版Cloudflare Worker：**

每天10万请求，每分钟1000请求，每个请求最多10毫秒CPU时间。

**免费版KV存储：**

每天10万次读、1000次写入、1000次列举、1000次删除。所有数据总共最多1GB。每个Key 512字节，每个Value 25MB。

这意味着每天最多有1000条新评论。每20条评论，也就是每个batch可以存储25MB，我甚至可以做一个免费的图床了。

那么付费了以后能怎样呢？咱莫的钱，不关心

# 写在最后

目前，整个系统已经稳定运行了一段时间，暂时没有发现太多问题。接下来就看他能不能经受时间的考验，只要Cloudflare还活着，则永不宕机。