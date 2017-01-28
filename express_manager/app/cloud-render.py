bl_info = {
    "name": "Cloud render",
    "author": "Dacre capstick",
    "version": (1, 0),
    "blender": (2, 78, 0),
    "location": "View3D > Tools > Cloud render",
    "description": "Allows you to render animations on the cloud",
    "warning": "",
    "wiki_url": "",
    "category": "Render",
    }


import bpy
import os
import sys
import errno
import shutil
import json
import requests

from requests.exceptions import ConnectionError
from bpy.types import Menu, Panel, UIList

"""
blender_file_path = bpy.data.filepath
blender_file_directory = os.path.dirname(blender_file_path)
blender_filename = bpy.path.basename(bpy.context.blend_data.filepath)

blenderFile = os.path.join( blender_file_directory , blender_filename)
print(blenderFile)
f = open('data.txt','w')
f.write(blenderFile) # python will convert \n to os.linesep
f.close()
"""
class View3DPanel():
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'TOOLS'

class sendToRenderFarm (bpy.types.Operator):
    bl_idname = "blender_cloud.send_job"
    bl_label = "Save and Send"


    def execute(self, context):
        print('sending to cloud');
        C = context
        D = bpy.data
        scn = C.scene
        wm = bpy.context.window_manager
        user_preferences = context.user_preferences

        # test to see if project name has been specified and deal with the result appropriately
        if not wm.cloud_project:
            project_name = 'untitled'
        else:
            project_name = wm.cloud_project

        #test to see if the job name has been specified and deal with the result appropriately
        if not wm.job_name:
            job_name = 'untitled_job'
        else:
            job_name = wm.job_name

        start_frame = scn.frame_start
        end_frame = scn.frame_end
        count_frames = end_frame - start_frame + 1
        node_quantity = abs(wm.node_quantity)
        remainder = count_frames%node_quantity
        temp_frame_count = count_frames - remainder
        chunk_size = round(temp_frame_count/node_quantity)
        no_of_chunk = node_quantity - remainder
        machines = node_quantity

        job_settings = {}
        job_settings['first_frame'] = start_frame
        job_settings['last_frame'] = end_frame
        job_settings['no_of_machines'] = machines
        job_settings['chunk_size1'] = chunk_size
        job_settings['no_of_chunk1'] = no_of_chunk
        job_settings['chunk_size2'] = (chunk_size+1)
        job_settings['no_of_chunk2'] = remainder
        job_settings['render_engine'] = (scn.render.engine)
        job_settings['render_settings'] = ''
        job_settings['format'] = (wm.file_format)

        job_properties = {}
        job_properties['project_name'] = project_name
        job_properties['settings'] = job_settings
        job_properties['name'] = job_name
        job_properties['priority'] = (wm.priority)

        server_url = 'http://104.199.94.139:3000'

        blender_file_path = bpy.data.filepath
        blender_file_directory = os.path.dirname(blender_file_path)
        blender_filename = bpy.path.basename(bpy.context.blend_data.filepath)

        blenderFile = os.path.join( blender_file_directory , blender_filename)

        bpy.ops.wm.save_mainfile()


        try:
            headers = {'content-type': 'application/json'}
            server_setting_url = "{0}/get_settings".format(server_url)
            r = requests.post(server_setting_url, data = json.dumps(job_properties) ,  headers=headers ,   timeout=10)
            print (r.text)
        except ConnectionError as e:    # This is the correct syntax
            print (e)

        try:
            server_job_url = "{0}/get_blend".format(server_url)
            files = {'file': open(blenderFile, 'rb')}
            r = requests.post(server_job_url, files=files,   timeout=20)
            print (r.text)
        except ConnectionError as e:    # This is the correct syntax
            print (e)

        return {'FINISHED'}

class cloudRenderPanel(View3DPanel, Panel):
    bl_label = 'Send job'
    bl_context = 'objectmode'
    bl_category = 'Cloud render'

    def draw(self, context):
        D = bpy.data
        wm = bpy.context.window_manager
        scene = context.scene

        layout = self.layout

        obj = context.object

        col = layout.column()
        col.prop(wm, 'cloud_project')
        col.prop(wm, 'job_name')
        col.prop(wm, 'priority')
        col.prop(wm, 'file_format')

        col.separator()
        col.label(text="Cloud controls:")
        col.prop(wm, 'node_quantity')

        col.separator()
        col.label(text="Frames to render:")

        row = col.row(align=True)

        start_frame = scene.frame_start
        end_frame = scene.frame_end
        count_frames = end_frame - start_frame + 1

        remainder = count_frames%wm.node_quantity
        temp_frame_count = count_frames - remainder
        chunk_size = round(temp_frame_count/abs(wm.node_quantity) );
        no_of_chunk = abs(wm.node_quantity) - remainder

        row.label("Frame range: {0}:{1}".format(start_frame, end_frame))
        row.label("Frame Count: {0}".format(count_frames))
        if remainder == 0:
            col.label("Chunk size: {0}".format(chunk_size))
        else:
            col.label("Chunk size: {0} chunks of size {1}, {2} chunks of size {3}".format(no_of_chunk, chunk_size, remainder, chunk_size + 1))

        col.separator()
        row = layout.row()
        row.label('NOTE: to avoid large file transfer times remove all unnecessary image files from the project!')
        row = layout.row()
        row.operator("blender_cloud.send_job", icon="APPEND_BLEND")

#register http://www.blender.org/api/blender_py...
def register():
    bpy.utils.register_module(__name__)
    wm = bpy.types.WindowManager

    wm.cloud_project = bpy.props.StringProperty(
        name="Project ", default="", description="Cloud project name")

    wm.job_name = bpy.props.StringProperty(
        name="Job name ", default="", description="Name for this cloud job")

    wm.file_format = bpy.props.EnumProperty(
        items=[('EXR', 'EXR', ''), ('JPEG', 'JPEG', ''), ('PNG', 'PNG', ''),
            ('JPEG2000', 'JPEG2000', '') ],
        name="File Format",
        description="Output file format for the job")

    wm.start_frame = bpy.props.IntProperty(
        name="Start frame",
        description="First frame to render",
        default=1,
        soft_min=0,
        options={'HIDDEN', 'SKIP_SAVE'})

    wm.priority = bpy.props.IntProperty(
        name="Priority",
        description="Number to define the priority of this job, only useful when running multiple jobs",
        default=50,
        soft_min=0,
        options={'HIDDEN', 'SKIP_SAVE'})

    wm.end_frame = bpy.props.IntProperty(
        name="End frame",
        description="Last frame to render",
        default=250,
        soft_min=1,
        options={'HIDDEN', 'SKIP_SAVE'})

    wm.node_quantity = bpy.props.IntProperty(
        name="Machines",
        description="Number of machines used to carry out the job",
        default=5,
        min=2,
        max = 8,
        options={'HIDDEN', 'SKIP_SAVE'})


def unregister(): bpy.utils.unregister_module(__name__)

if __name__ == "__main__": register()
