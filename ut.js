var cp = require('child_process').spawn;


module.exports.spawn = function(cmd,args,cb){
	var z = this, exitCode ,errs = [] ,outs = [] ,c = 3
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

module.exports.fileTime =  function(date){
	var z = this, d = date ? date : new Date;
	return d.getFullYear()+'-'+z.padZ(d.getMonth()+1)+'-'+z.padZ(d.getDate())+'_'+z.padZ(d.getHours())+z.padZ(d.getMinutes())+z.padZ(d.getSeconds());
	//return d.getUTCFullYear()+'-'+z.padZ(d.getUTCMonth()+1)+'-'+z.padZ(d.getUTCDate())+'_'+z.padZ(d.getUTCHours())+z.padZ(d.getUTCMinutes())+z.padZ(d.getUTCSeconds())+'UTC';
}

module.exports.prettyTime = function(date){
	var z = this, d = date ? date : new Date;
	return z.padZ(d.getMonth()+1)+'/'+z.padZ(d.getDate())+'/'+d.getFullYear()+' '+z.padZ(d.getHours())+':'+z.padZ(d.getMinutes())+':'+z.padZ(d.getSeconds());
}

module.exports.padZ =  function(n){
	while ((n+'').length < 2)
		n = '0'+n;
	return n;
}
