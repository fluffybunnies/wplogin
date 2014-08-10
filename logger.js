var fs = require('fs')
,sext = require('sext')
,ut = require('./ut.js')
;

module.exports = {
	entrySep: '\n\n\n'
	,path: null
	,create: function(path,date){
		var z = this;
		if (z.path !== null)
			return console.log('Logger::create() called when log file already exists: ',z.path);
		var r = ut.fileTime(date||null)+'.log';
		z.path = path+r;
		fs.writeFile(z.path,ut.fileTime()+z.entrySep,function(err){
			if (err) {
				z.path = null;
			}
		});
	}
	,update: function(date,content){
		var z = this;
		if (z.path === null)
			return console.warn('Logger::update() called when log file not yet created');
		fs.exists(z.path,function(exists){
			if (!exists)
				return console.warn('Logger::update() - file does not exist',z.path);
			fs.appendFile(z.path,ut.prettyTime(date)+z.entrySep,function(err){
				if (err)
					console.warn('Unable to write to log file '+z.path,err);
			});
		});
	}
};