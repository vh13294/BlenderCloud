import bpy
import threading
import sys
import json
import requests

#import sys
#print(sys.path) 
#print(sys.version)

argv = sys.argv
#print(argv)

fo = open("/home/projectcloudbristol/ip.txt", "r")
line = fo.readline().splitlines() 

startF = argv[argv.index("-s") + 1]
endF = argv[argv.index("-e") + 1]
machineID = line[0]
    
#print(startF)
#print(endF)
#print(machineID)

#10.132.0.2
#130.211.97.146
server_url = 'http://10.132.0.2:3000'
http_url = "{0}/getProgress".format(server_url)

data = {}
headers = {'content-type': 'application/json'}

def every_frame(scene):
    print("Frame Change", scene.frame_current) 
    data['current_frame'] = scene.frame_current
    data['start_frame'] = startF
    data['end_frame'] = endF
    data['internal_ip'] = machineID.strip("\n")
    data['complete'] = 0
    
    try:
        response = requests.post(http_url, data=json.dumps(data) ,  headers=headers ,   timeout=10)  
    except requests.exceptions.RequestException as e:
        print (e)

bpy.app.handlers.frame_change_pre.append(every_frame)


def render_complete(scene):
    print("done")
    data['complete'] = 1
    
    try:
        response = requests.post(http_url, data=json.dumps(data),  headers=headers ,   timeout=10)
    except requests.exceptions.RequestException as e:
        print (e)
    
bpy.app.handlers.render_complete.append(render_complete)
