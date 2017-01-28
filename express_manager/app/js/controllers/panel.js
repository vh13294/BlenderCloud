/*global angular */

/**
 * The main controller for the app. The controller:
 * - retrieves and persists the model via the todoStorage service
 * - exposes the model to the template and provides event handlers
 */
angular.module('blenderFarm')
	.controller('panelCtrl', function TodoCtrl($scope,$http, socket) {

		'use strict';

    	$scope.job_list = [];
		$scope.completed_jobs = [];
		$scope.errored_list = [];
		$scope.visible_jobs = $scope.job_list;
		$scope.active_index = 0;
		$scope.job_settings = [];
		$scope.machines_up = [5, 2, 4];
		$scope.render_progress = 0;
		$scope.task_list = [];
		$scope.uptime;
		$scope.job_progress = 0;		
		$scope.complete = 1;		
		$scope.hide_zipping = 1;
		$scope.hide_download = 1;	
		$scope.visible_tasks = [];	
		var complete_tasks;			
	
		socket.on('updatejobs', function(data){
            $scope.job_list = data.jobs;
			$scope.completed_jobs = data.completed;
			$scope.visible_jobs = $scope.job_list.concat($scope.completed_jobs);
			complete_tasks = data.completedTasks;
			$scope.task_list = data.currentTasks;
			$scope.$apply();
				
        });	
		socket.on('getTasks', function(data){
			$scope.task_list = data.tasks;
			$scope.visible_tasks = $scope.task_list;
			$scope.$apply();
			console.log("get tasks");
			
		});	
		//detect when the task is complete
		socket.on('taskComplete', function(data){
			console.log("task complete");
		});
		
		//get the status of the machines
		socket.on('updateStatus', function(data){
        	$scope.task_list[data.index].status = data.status;
			$scope.task_list[data.index].seconds = data.seconds;
//			console.log($scope.task_list[data.index].seconds)
			setTime();
			$scope.$apply();
			//console.log(data.status);
		});
		
		//notify frontend when the files are uploaded
		socket.on('uploadComplete', function(data){
			console.log("upload complete");
			$scope.job_list[0].upload_progress = 100;
			$scope.$apply();
		});

		//reload information on refresh
		socket.on('load', function(data){
			$scope.job_list = data.jobs;
			$scope.task_list = data.machine_info;
			$scope.visible_tasks = data.machine_info;
			$scope.visible_jobs = $scope.job_list;
			complete_tasks = data.completeTasks;
			$scope.completed_jobs = data.completed;
			if($scope.job_list.length > 0){
				if($scope.job_list[$scope.active_index].complete == 1){
					$scope.complete = 0;
				}
			}
			console.log(complete_tasks);
		});
		socket.on('jobComplete', function(data){
			console.log("all render complete");
			$scope.job_list[$scope.active_index].complete = 1;
			$scope.complete = 0;
			$scope.$apply;			
		});	
		//receuve render settings from the server
		socket.on('renderSettings', function(data){
			$scope.job_list = data.job_info;
			$scope.visible_jobs = $scope.job_list;
			//console.log(data.job_info);
		});

		//get the progress of the tasks
		socket.on('progressUpdate', function (data) {
			//$scope.task_list = data;
			//$scope.$evalAsync(function(){
			//console.log(data);
			if($scope.task_list.length == 0){
				$scope.task_list = data.data;
			}
			else{
				$scope.task_list[data.index].progress = Math.round(data.data[data.index].progress);
			}
		//	});
			var all_progress = 0;
			var j;
			if($scope.job_list.length > 0){
				$scope.job_list[$scope.active_index].progress = data.job_progress;
			}			
			$scope.$apply();
	 	});

/*		$scope.testDisable = function(){
			$scope.complete = !$scope.complete;
		}*/
		$scope.updateVisible = function(){
			if($scope.completed == true){
				$scope.visible_jobs = $scope.job_list.concat($scope.completed_jobs);
				console.log($scope.completed_jobs);
				console.log($scope.visible_jobs);
			}
			else{
				$scope.visible_jobs = $scope.job_list;
			}
		}
		
		//count uptime of instances
        function setTime()
        {
			for(var i = 0; i <$scope.task_list.length; i++){
				$scope.task_list[i].formatted = pad(parseInt($scope.task_list[i].seconds/60)) + ':' +  pad($scope.task_list[i].seconds%60);
				$scope.$apply();				
			}
        }

		function pad(val)
        {
            var valString = val + "";
            if(valString.length < 2)
            {
                return "0" + valString;
            }
            else
            {
                return valString;
            }
        }


		$scope.updateProgress = function(){
		  $scope.uploadProgress += 10;
		  $scope.renderProgress +=10;
		  if($scope.uploadProgress > 100){
			$scope.uploadProgress = 100;
		  }
		  if($scope.renderProgress > 100){
			$scope.renderProgress = 100;
		  }
		}
		$scope.zipProject = function(){
			$scope.hide_zip = 1;
			$scope.hide_zipping = 0;
			$http({
              method: 'GET',
              url: 'http://104.199.94.139:3000/compressFile'
            }).then(function successCallback(response) {
                // this callback will be called asynchronously
                // when the response is available
				console.log(response);
				$scope.hide_download = 0;
				$scope.hide_zipping = 1;

              }, function errorCallback(response) {
                // called asynchronously if an error occurs
                // or server returns response with an error status.
              });
		}
		$scope.killJob = function(idx){
			/**************kill job here*****************/
			console.log(idx);
			$http({
			  method: 'GET',
			  url: 'http://104.199.94.139:3000/killJob',
			  data: { index: idx }
			}).then(function successCallback(response) {
				// this callback will be called asynchronously
				// when the response is available
				
				
			  }, function errorCallback(response) {
				// called asynchronously if an error occurs
				// or server returns response with an error status.
			  });	
/*
			$scope.job_list[idx].status = 'killed';
			$scope.completed_jobs.push($scope.job_list[idx]);
			$scope.job_list.splice(idx, 1);

			if($scope.active_index == idx){
				$scope.changeActiveJob(idx)
				$scope.completedChange();
			}
*/

		}

		$scope.changeActiveJob = function(idx){
			$scope.active_index = idx;
			for(var i = 0; i < $scope.visible_jobs.length; i++){
				$scope.visible_jobs[i].active = 0;
			}
			if($scope.visible_jobs[idx].complete == 1){
				$scope.visible_tasks = complete_tasks[idx-$scope.job_list.length];
			}
			else{
				$scope.visible_tasks = $scope.task_list;
			}
			$scope.visible_jobs[idx].active = 1;
		}


	});
