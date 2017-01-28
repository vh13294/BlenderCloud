angular.module('blenderFarm')
	.factory('socket', function (socketFactory) {
			console.log("socket start");
	    return socketFactory();
});
