var test = require('tape')
,level = require('../level')
;

test('levs',function(t){
	var host = 'www.myblog'+ +new Date +'.com'
	,dict = __dirname+'/../dict.example'
	;
	console.log(['Host: '+host, 'Dictionary: '+dict, '\n'].join('\n'));

	level.saveResult(host, 'ralph', 'password', dict, 1, function(err,data){
		level.saveResult(host, 'ralph', 'password2', dict, 0, function(err,data){
			level.getResultsForHostUser(host, 'ralph', function(err,data){
				console.log(err,data);
				t.equal(data.length, 2, 'level worky')
				t.end();
			});
		});
	});
});
