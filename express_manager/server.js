var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fileUpload = require('express-fileupload');

var util   = require('util'),
    exec  = require('child_process').exec,
    child;

var jsonfile = require('jsonfile');
// Imports the Google Cloud client library
var gcs = require('@google-cloud/storage')();
var bucketName = gcs.bucket('blenderbucket');

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

var finishedJobs = [];
var completedTasks = [];
// view engine setup
app.set('view engine', 'html');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '/app')));
app.use(fileUpload());

//var settings = {'first_frame' : 0, 'last_frame' : 20, 'no_of_machines' : 2, 'chunk_size1' : 10, 'no_of_chunk1' : 2 , 'chunk_size2' : 11, 'no_of_chunk2' : 0, 'render_engine' : 'CYCLES', 'format' : 'EXR'};
var machines_up = 0;
var machines_finished = 0;
var instance_group_name = 'instance-group-worker-v5';
var machine_info = [];
var job_info = [];
var id = -1;
var manager;
var blend_uploaded = 0;
var blend_file = '/mnt/blender_bucket/render.blend';
var locked = false;
var manager_ip = "10.132.0.2";
io.sockets.on('connection',  function (socket) {
//  console.log(job_info);
//  console.log(machine_info);
  socket.emit('load', {
    jobs : job_info,
	machine_info : machine_info,
	completed: finishedJobs,
	completeTasks: completedTasks
  });
});

app.get('/getError', function(req, res){
	console.log("get error:");
	console.log(req.query.error1);
	//console.log(req.query.error2);
	res.send("received");
});

app.get('/test', function(req,res){
	console.log(nth);
	res.send("done");
});
setInterval(function () {
	instanceStatus();
}, 3000);

var recompute = false;

function instanceStatus(){
	//check so see if all of the tasks are complete
	/*	
	for(var k = 0; k < machine_info.length; k++){
		
	}*/	
	//if(machine_info.length > 0){
		
	
	//	if(machine_info.length < job_info.settings.no_of_machines){

	//	}
		
		for(var i = 0; i < machine_info.length; i++){
		//	console.log(machine_info[i].IP);
			if(machine_info[i].IP === undefined){
				recompute = true;
			}
		}
		if(job_info.length > 0){
			if(machine_info.length < job_info[0].settings.no_of_machines || recompute == true){
				emptyMachineInfo(computeMachines);
				recompute = false;
			}
		}
		child = exec('sudo gcloud compute instances list --format json',{timeout: 1800} ,
			function (error, stdout) {
				try {
					data = JSON.parse(stdout);
  				} catch (e) {
    				return null;
  				}	
					
				for(var j = 0; j < data.length; j++){
					var internal_ip = data[j].networkInterfaces[0].networkIP;
					var index = -1;
					machine_info.findIndex(function(item, i){           
						if(item.IP == internal_ip){
							index = i;
						}
                	});
					if(index != -1){
						if(data.length == 2 && machine_info[index].complete == 1){
							jobComplete(addToFinished, "Complete- render may contain errors");
							io.sockets.emit('updatejobs', {
								jobs: job_info,
								completedTasks: completedTasks,
								currentTasks: machine_info,
								completed: finishedJobs
							});
						}				
						if(machine_info[index].status == 'RUNNING' && machine_info[index].complete != 1){
                            //console.log(machine_info[index].seconds); 
                            machine_info[index].seconds= machine_info[index].seconds+3;
							machine_info[index].formatted = pad(parseInt(machine_info[index].seconds/60)) + ':' +  pad(machine_info[index].seconds%60);
                        } 
						machine_info[index].status = data[j].status;						
						io.sockets.emit('updateStatus', {
							status:machine_info[index].status,
							seconds:machine_info[index].seconds,
							index : index
						});
					}
				}
				if (error !== null) {
					console.log('exec error: ' + error);
				}
		});
	//}
}

function emptyMachineInfo(callback){
	machine_info = [];
	callback();
}

function computeMachines(){
	child = exec('sudo gcloud compute instances list --format json',{timeout: 1800} ,
                function (error, stdout) {
                    try {
                        data = JSON.parse(stdout);
                    } catch (e) {
                        return null;
                    }


                    for(var i = 0; i <data.length; i++){
                            if(data[i].name != 'blender-worker1' && data[i].status != "TERMINATED" && data[i].status != "STOPPING"){
                                var machine = {'IP' :  data[i].networkInterfaces[0].networkIP, 'progress': 0, 'frames': 'DISTRIBUTING', 'status':'', 'seconds':0, 'formatted' : '00:00', 'complete' : 0};
                                machine_info.push(machine);
                            }
                        }
                        //var temp_machine_info.machines = job_machines;
                        //temp_machine_info.id = job.id;
                    //  machine_info.push(temp_machine_info);
                        io.sockets.emit('getTasks', {
                            tasks: machine_info
                        });

                    if (error !== null) {
                        console.log('exec error: ' + error);
                    }
                });
}

var resetProcess;
function safeResetServer()
{
	console.log('safe reset trigger');
	resetProcess = exec('sleep 800 && gcloud compute instance-groups managed resize instance-group-worker-v5 --size 0  --zone europe-west1-c && sudo pm2 restart all');
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

app.get('/compressFile', function(req,res){
	child = exec( 'sudo rm /mnt/blender_bucket/project.zip && sleep 10' ,
    function () {
        child = exec( 'sudo zip -rj /mnt/blender_bucket/project.zip /mnt/blender_bucket/output/ && sleep 5' ,
        function () {
          	child = exec( 'sudo rm -rf /mnt/blender_bucket/output/*'); 
            res.send('complete');
        });
    });

});

app.get('/killJob', function(req,res){
	var idx = req.body.index;
	console.log(idx);
	console.log("kill job");
	var command = 'gcloud compute instance-groups managed resize ' + instance_group_name + ' --size 0  --zone europe-west1-c';
//	command = '';	
	manager.kill();
	child = exec(command, 
	function (error, stdout, stderr) {
		if (error !== null) {
			console.log('exec error: ' + error);
		}
		else{
			jobComplete(addToFinished, "Terminated by user");	
			io.sockets.emit('updatejobs', {
				jobs: job_info,
				completedTasks: completedTasks,
				currentTasks: machine_info,
				completed: finishedJobs
			});
		}
	});
	console.log(finishedJobs);

	res.send("done");
});
app.get('/cloudplugin.py', function(req,res){
    var file = __dirname + '/app/cloud-render.py';
    res.download(file); // Set disposition and send it.
});

app.get('/project.zip', function(req,res){	
	var zip_file = bucketName.file('project.zip');
	zip_file.get(function(err, file, apiResponse) {
		res.setHeader('Content-Disposition', 'attachment; filename=' + zip_file.name);
		zip_file.download(function(err, contents) {
			res.send(contents);
		});
	});		
});

app.get('/queryTest', function(req,res){
    res.send(req.query);
});

app.post('/id', function(req, res){
	var IP = req.body.ip;//req.body.internal_ip);
	console.log(IP);
	res.send("received");
});

app.post('/get_blend', function(req, res) {
	var sampleFile;
    if (!req.files) {
        res.send('No files were uploaded.');
        return;
    }
	var job_size = job_info.length-1;
	console.log(job_size);
	if (job_size>=0){
		console.log("job size");
		console.log(job_info[job_size].complete);
	}
	if(locked == false){	
		sampleFile = req.files.file;
		console.log(sampleFile);
		sampleFile.mv('/mnt/blender_bucket/render.blend', function(err) {
			if (err) {
				res.status(500).send(err);
			}
			else {
				res.send('File uploaded!');
				locked = true;
				job_info[0].upload_progress = 100;
				io.sockets.emit('uploadComplete', {
				});
			}
		});
	}
	else
	{
		res.send("file exisited");
	}
});

app.post('/get_settings', function(req,res){	
	if(job_info.length == 0){
		settings =  req.body.settings;
		var job = req.body;
		job.progress  = 0;
		job.complete_tasks = 0;
		job.upload_progress = 0;
		id = id + 1;
		job.id = id;	
		job_info.push(job);
		job.status = "IN PROGRESS"	
		io.sockets.emit('renderSettings', {
			 job_info: job_info
		});

	 	var number_of_machines = settings.no_of_machines;
		console.log(job_info);
		var command = 'gcloud compute instance-groups managed resize ' + instance_group_name + ' --size ' + ( number_of_machines - 1) + ' --zone europe-west1-c && sleep 10';	
		child = exec(command, 
		function () {	
				safeResetServer();				
/*				child = exec('sudo gcloud compute instances list --format json',
					function (error, stdout, stderr) {
					var data = JSON.parse(stdout);
					var job_machines = [];
					for(var i = 0; i <data.length; i++){
						if(data[i].name != 'blender-worker1' && data[i].status != "TERMINATED" && data[i].status != "STOPPING"){
							var machine = {'IP' :  data[i].networkInterfaces[0].networkIP, 'progress': 0, 'frames': 'DISTRIBUTING', 'status':'', 'seconds':0, 'formatted' : '00:00', 'complete' : 0};
							machine_info.push(machine);
						}
					}
					//var temp_machine_info.machines = job_machines;
					//temp_machine_info.id = job.id;
				//	machine_info.push(temp_machine_info);
					io.sockets.emit('getTasks', {
                	tasks: machine_info});	
				});*/
		});
			
		var file = 'settings.json';
			var obj = settings;

			jsonfile.writeFile(file, obj, function(err) {
				//console.error(err)
			});
		
		//res.send(command);
		res.send('done');
	}
	else{
		res.send("job in progress");
	}
});


app.get('/render_finished', function(req, res){
	var IP = req.query.internal_ip;;
	render_finished(IP);
	res.send("complete");	
});

function render_finished(IP)
{
    machine_info.findIndex(function(item, i){
        if(item.IP == IP){
            index = i;
        }
    });

    job_info[0].complete_tasks +=1;
	console.log(job_info[0].settings.no_of_machines);
	console.log(job_info[0].complete_tasks);
    machine_info[index].complete = 1;
    if(job_info[0].complete_tasks == job_info[0].settings.no_of_machines){
		
        console.log('socket emit jobComplete');
        io.sockets.emit('jobComplete', {});
        jobComplete(addToFinished, "Complete");
        console.log("here");
        io.sockets.emit('updatejobs', {
            jobs: job_info,
            completedTasks: completedTasks,
            currentTasks: machine_info,
            completed: finishedJobs
        });
        //halt the signal to reset the server
        resetProcess.kill();
    }
}

app.get('/machines', function(req, res){
	if(typeof machines_finished  !== 'undefined' && machines_finished){
		res.send(machines_finished);	
	}
	else{
		res.send('none up yet');
	}
});
//var test_data = {'IP' :  '10.132.0.3', 'progress': 0, 'frames': '10-20', 'status':'rendering', 'seconds':0, 'formatted' : '00:00', 'complete' : 0};
//machine_info.push(test_data);
app.post('/getProgress', function(req, res){
	var start_frame = req.body.start_frame;
	var end_frame  = req.body.end_frame;
	var current_frame = req.body.current_frame;
	var complete = req.body.complete;
	var IP = req.body.internal_ip;
	var index = -1;
	var render_progress = ((current_frame - start_frame)/(end_frame-start_frame))*100;	
	
	machine_info.findIndex(function(item, i){
		if(item.IP == IP){
			index = i;
		}
	 	
	});
	
	if(index != -1){
		machine_info[index].progress = render_progress;
	}
	var all_task_progress = 0;
	var number = machine_info.length;
	for(var j = 0; j < number; j++){
		all_task_progress += machine_info[j].progress;
	}
	job_info[0].progress = Math.round(all_task_progress/number);

	io.sockets.emit('progressUpdate', {
        data: machine_info,
		job_progress: job_info[0].progress,
		index : index
    });	
/*	if(complete == 1){
		job_info[0].complete_tasks +=1;
		machine_info[index].complete = 1;
		if(job_info[0].complete_tasks == job_info[0].settings.no_of_machines){
			console.log('socket emit jobComplete');
			io.sockets.emit('jobComplete', {});
			jobComplete(addToFinished, "Complete");
			console.log("here");
			io.sockets.emit('updatejobs', {
                jobs: job_info,
                completedTasks: completedTasks,
                currentTasks: machine_info,
                completed: finishedJobs
            });	
			//halt the signal to reset the server
			resetProcess.kill();
		}
	}*/
	res.send("received");	
});

function terminateMachines(){
	child = exec('gcloud compute instance-groups managed resize ' + instance_group_name + ' --size 0 --zone europe-west1-c',
	function (error, stdout, stderr) {
		data = JSON.parse(stdout);
		if (error !== null) {
			console.log('exec error: ' + error);
		}
	});
}

function jobComplete(callback, jobStatus){
	var temp_job = job_info[0];
	machines_up = 0;
    temp_job.status = jobStatus;
    temp_job.complete = 1;
	for(var i = 0; i < machine_info.length; i++){
		machine_info[i].status = "terminated";
	}
	completedTasks.push(machine_info);
	if(typeof(callback) == "function"){
		callback(temp_job);
	}
	locked = false;
}

function addToFinished(job){
	finishedJobs.push(job);
	machine_info = [];
	job_info = [];
}

app.get('/get_machine_ip', function(req, res){
	res.send(machine_info);
});


app.get('/worker_error', function(req, res){
    console.log ( req.query.errorMessage );
	res.send("reported");
});


app.get('/machine_ready', function(req, res){
 	var machine_ip = req.query.internal_ip;
	//var machine_ip = '1';	
	if(machines_up ==0){
		startManager();
	}	
	machines_up += 1;
 			
	var machine_command = '';
	if(machines_up <= settings.no_of_chunk1){	
		var start_frame = ((machines_up - 1) * settings.chunk_size1) + 1;
		var end_frame = machines_up * settings.chunk_size1;
		var machine_command = 'sudo blender -b  ' + blend_file + ' -E ' + settings.render_engine  + ' -F ' + settings.format + ' -o ' + '/mnt/blender_bucket/output/' + 'frame_#####' + ' -s ' + start_frame + ' -e ' + end_frame + ' --python /home/projectcloudbristol/percentage.py' +  ' -a'; 	
	} 
	else{
		var start_frame = (machines_up * settings.chunk_size1) + ((machines_up - settings.no_of_chunk1 - 1) * settings.chunk_size2) + 1;
		var end_frame = (machines_up * settings.chunk_size1) + ((machines_up - settings.no_of_chunk1) * settings.chunk_size2) ;
		var machine_command = 'sudo blender -b  ' + blend_file + ' -E ' + settings.render_engine + ' -F ' + settings.format + ' -o ' + '/mnt/blender_bucket/output/' + 'frame_#####' + ' -s ' + start_frame + ' -e ' + end_frame + ' --python /home/projectcloudbristol/percentage.py'  + ' -a'; 	
	}
	machine_info[machines_up - 1].frames = start_frame + '-' + end_frame;	
	
	console.log(machine_info);
	res.send(machine_command);
});

function startManager(){
	 	var machine_ip = '10.132.0.2'; 
		var start_frame;
		if(settings.no_of_chunk2 != 0){
        	start_frame = settings.last_frame - settings.chunk_size2; 
        }
		else{
			start_frame = settings.last_frame - settings.chunk_size1;
		}
		var end_frame = settings.last_frame; 
        var machine_command = 'sudo blender -b  ' + blend_file + ' -E ' + settings.render_engine + ' -F ' + settings.format + ' -o ' + '/mnt/blender_bucket/output/' + 'frame_#####' + ' -s ' + start_frame + ' -e ' + end_frame + ' --python /home/projectcloudbristol/percentage.py' + ' -a';      
        machine_info[machines_up].frames = start_frame + '-' + end_frame; 
		manager = exec(machine_command, {timeout: (10*60*1000)}, 
		function (error){
			console.log("manager finished");
			render_finished(manager_ip);
		});
}

app.get('/setting_test', function(req, res){
	res.send(settings);
});

app.use(function(req, res) {
	res.sendFile(__dirname + '/app/index.html');
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handler
app.use(function(err, req, res, next) {
	console.error("Custom error message by me");
	console.error(err.stack);
  	res.status(500).send(String(JSON.stringify(error, ["message", "arguments", "type", "name"])));
/*
	// set locals, only providing error in development
	res.locals.message =  err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.render('error');*/
});

app.exportServer = server;
module.exports = app;

