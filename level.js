var config = require('./config')
,db = require('level')(__dirname+'/'+config.db.engines)
,sext = require('sext')
,delim = 'ÿ'
,keyMap = ['host','user','file','pass']
;

module.exports = {
	getResultsForHostUser: function(host, user, cb){
		var z = this
		,key = z.join(host,user,'')
		,results = []
		;
		db.createReadStream({
			start: key
			,end: key+'\xff'
		}).on('error',function(err){
			cb(err);
			cb = function(){};
		}).on('data',function(data){
			results.push(data);
		}).on('end',function(){
			cb(false, z.formatResults(results));
		});
	}
	,getResultsForHostUserFile: function(host, user, file, cb){
		var z = this
		,key = z.join(host,user,file,'')
		,results = []
		;
		db.createReadStream({
			start: key
			,end: key+'\xff'
		}).on('error',function(err){
			cb(err);
			cb = function(){};
		}).on('data',function(data){
			results.push(data);
		}).on('end',function(){
			cb(false, z.formatResults(results));
		});
	}
	,saveResult: function(host, user, file, pass, result, cb){
		var key = this.join(host,user,file,pass);
		db.put(key,result,function(err){
			if (cb)
				cb(err, {key:key});
		});
	}
	,formatResults: function(results){
		var z = this;
		results.forEach(function(v,i){
			results[i] = z.split(v.key,v);
			delete results[i].key;
		});
		return results;
	}
	,join: function(){
		return Array.prototype.slice.call(arguments).join(delim);
	}
	,split: function(key,extend){
		var o = {};
		key.split(delim).forEach(function(v,i){
			//if (v === '') return;
			o[keyMap[i]] = v;
		});
		if (extend)
			sext(o,extend);
		return o;
	}
};