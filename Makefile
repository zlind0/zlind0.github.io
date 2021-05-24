postlist.md: posts/* postlist.template.md
	cp postlist.template.md postlist.md
	ls posts|grep \\.md|sort -r|sed "s/\(^[0-9-]*\)/\`\1\`/g;s/^/- /g; s/\.md//g" >> postlist.md

clean:
	rm postlist.md