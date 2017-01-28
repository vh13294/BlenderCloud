'use strict';

 var application = angular.module('blenderFarm', [
   'ngAnimate',
   'ngSanitize',
   'ui.bootstrap',
   'ngRoute',
   'ngMaterial',
   'btford.socket-io'
//	'ngCookies'
 ]);

 application.config(['$routeProvider','$locationProvider',
   function($routeProvider,$locationProvider) {
       $locationProvider.html5Mode({
           enabled: true,
           requireBase: false
       });
       $routeProvider.
           when('/', {
               templateUrl: 'views/overview.html'
           })
   }]);
