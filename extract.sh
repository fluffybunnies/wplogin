#!/bin/bash
# ./bin/extract.sh ./~dicts/

dir="$1"
if [ "$dir" == '' ]; then
	echo 'this seems like a mistake...'
	exit 1
fi
if [ "${dir:$((${#str}-1)):1}" != "/" ]; then
	dir=$dir'/'
fi
echo "extracting $dir*"
for f in "$dir"*; do
	[ -f "$f" ] || continue
	gunzip -f "$f"
done
for f in "$dir"*; do
	if [ `echo "$f" | sed -e 's/\.tar//'` != $f ]; then
		[ -f $f ] || continue
		tar xf "$f" -C $dir
		rm -f "$f"
	fi
done