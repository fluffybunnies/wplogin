var fs = require('fs')
,sext = require('sext')
,ut = require('./ut.js')
;

module.exports = {
	entrySep: '\n\n'
	,pathRoot: null
	,getPath: function(suffix){
		return this.pathRoot ? this.pathRoot + (suffix?'.'+suffix:'') + '.log' : null;
	}
	,create: function(path,content){
		var z = this
			,logPath = z.getPath()
		;
		if (logPath !== null)
			return console.log('Logger::create() called when log file already exists: ',logPath);
		z.pathRoot = path + ut.fileTime();
		logPath = z.getPath();
		for (var i=2,c=arguments.length;i<c;++i)
			content += '\n\n'+arguments[i];
		fs.writeFile(logPath,content+z.entrySep,function(err){
			if (err)
				console.log('Logger: failed to create '+logPath,err);
		});
	}
	,update: function(content,cb){
		var z = this
			,logPath = z.getPath()
			,cb = cb || function(){}
		;
		if (logPath === null) {
			console.log('Logger::update() called when log file not yet created');
			return cb();
		}
		for (var i=1,c=arguments.length;i<c;++i)
			content += '\n\n'+arguments[i];
		fs.appendFile(logPath,content+z.entrySep,function(err){
			if (err)
				console.log('Unable to write to log file '+logPath,err);
			cb();
		});
	}
	,addErroredAttempt: function(pass){
		var z = this
			,logPath = z.getPath('failed')
		;
		if (logPath === null)
			return console.log('Logger::addErroredAttempt() called when log file not yet created');
		for (var i=1,c=arguments.length;i<c;++i)
			content += '\n\n'+arguments[i];
		fs.appendFile(logPath,pass+'\n',function(err){
			if (err)
				console.log('Unable to write to log file '+logPath,err);
		});
	}
};