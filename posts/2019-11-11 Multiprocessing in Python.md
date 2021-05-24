# MultiProcessing in Python

Recently, due to excessive need of processing binary executable data, I dig into python’s `multiprocessing` library, which is able to process data in a parallel way, unleashing full potential of modern multi-core processor. 

## Why use multiprocessing instead of threading?

Obviously, when thinking about parallel computing, threading is the most suitable option. Different threads have their own stack while sharing the same addressing space, which facilitate data exchanging. However, different from other low-level language, most implementations of python has a limitation on threading, called GIL, Global Interpreter Lock. It guarantees that only one interpreter thread is running, thus only one CPU core is utilized. Currently, except Jython (Java implementation of python) and IronPython (.NET implementation), other implementations of python, including the most popular Cython have this limitation. Therefore, multiprocessing seems to be a universal solution. 

## Basic concept

The basic usage of multiprocessing is to spawn a process and enter the specific function.
The following example spawns a new process and then enters the `f` function. Then child process joins father process so that the program will wait for it to finish executing.

```
from multiprocessing import Process
 
 def f(name):
     print 'hello', name
 
 if __name__ == '__main__':
     p = Process(target=f, args=('bob',))
     p.start()
     p.join()
```

__There are some OS-specific stuff which will be explained in detail.__
When there is a list of pending jobs, process pool can be used. A process pool will guarantee the exact amount of running process, as fewer processes cannot unleash the full potential of system and more processes will consume more valuable resources and significantly slow down the overall speed. 
The following example maps a job list to a function. `Pool(5)` means that no more than 5 processes will be running concurrently. `map` takes an iterator. The result of `p.map` is a list of returning values of called function, which, in this case is`f`.

```
from multiprocessing import Pool

def f(x):
    return x*x

if __name__ == '__main__':
    p = Pool(5)
    print(p.map(f, [1, 2, 3]))
```

Apart from `map`, there are other mapping methods like `imap`, which releases the return value as iterator. 

```
value_itr=p.imap(f, [1, 2, 3])
for v in value_itr:
	...
```

Its advantage is that we don’t have to wait until all the jobs are finished. And we can have a clear image of how many jobs have been finished. It allows some interesting tricks, such as to make a progress bar or to pass return value as job list to another pool or to create a producer-consumer model to avoid too much data being prepared.

## Passing data between processes

Since different processes don’t share addressing space, they only communicate through IPC (Interprocess Communication) or shared memory. Python has a `Manager` module that solves all these problems.

```
from multiprocessing import Process, Manager

def f(d, l):
    d[1] = '1'
	l.append('2')

if __name__ == '__main__':
    manager = Manager()

    d = manager.dict()
    l = manager.list(range(10))

    p = Process(target=f, args=(d, l))
    p.start()
    p.join()
```

In this case, `d` and `l` shares between different processes. Note that they cannot be pickled like `list`.  But they can easily converted to `list`.
Processes can also communicate by pipes. 
It’s suggested that we shall not store too much data in manager. Synchronization will waste much time by pending many processes. 
If a lot of data will be sharing between processes, one option is to benefit from Unix’s “copy on write”, which I am going to talk next.

## Spawning processes on different OSes

As we know, Unix-based system spawns process by forking. Everything remains the same except return value of `fork()`. Parent process will receive PID of child process but child process will receive 0. Also, they have a “copy on write” technique which means that when forking, the same memory will not be copied actually until one process intends to change that memory. Therefore, the forked process is able to access all the data from its parent process without actually copying it. This is dramatically faster than `Manager`.

However, in Windows, things are different. It creates a new process and import the whole python script. Then, it calls the target function.

This is why we need `if __name__ == '__main__':`. This is to ensure that the code will not run unexpectedly in the importing process. Otherwise, the spawned process will continue to spawn processes. 

## One more step further into `map`

`map` distributes jobs to spawned processes. It works as this. Firstly, some processes are spawned. Then, jobs are mapped to those processes in chunks. When one chunk of jobs is finished, this process will communicate with the main process and pass return values. Afterwards, it receives new jobs. This loop will continue until job list is empty or it is killed.
There are 2 problems.

1. If a process takes more jobs, it consumes more memory. Only by killing this process can the memory be released. But spawning and killing processes take time. This can be adjusted by setting parameter `maxtasksperchild ` of `Pool`.

2. Jobs are sent to processes by chunks. If chunk size is big but iterator produces jobs slowly, it takes more time waiting. Bigger chunk size also means more memory consumption. This can be adjusted by setting parameter `chunksize` of `imap`.

```
with Pool(processes=32, maxtasksperchild=100) as po:
        res=po.imap(data_process,sql_iter(), chunksize=1)
```
