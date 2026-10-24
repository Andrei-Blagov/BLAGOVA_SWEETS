#!/usr/bin/env python3
"""REVIEW CANDIDATE ONLY. No dispatch/run is authorized by presence of this file."""
import argparse
import base64
import fcntl
import gzip
import hashlib
import io
import json
import os
import re
import shutil
import signal
import stat
import subprocess
import tarfile
import time
from pathlib import Path, PurePosixPath

APP_SHA = '58209191d20dee16b22a5d2a1a753c36080860ed'
PREVIEW_SHA = '054e694398aa52330734adc027eba2dab8d3142d'
LIVE = Path('/opt/blagova-sweets-preview')
LIVE_NAME = 'blagova-sweets-preview-storefront-1'
MAX_EXPANDED = 400 * 1024 * 1024
MAX_COMPRESSED = 128 * 1024 * 1024
# A build step fills this from the three unchanged raw Git blobs at APP_SHA.
A1_SCRIPTS = {'deploy-preview.sh': {'sha256': '84f4d79c5d75880eca8a4acaf09ebf2affabc9cef51a9194667ca29be647aa24', 'base64': 'IyEvdXNyL2Jpbi9lbnYgYmFzaApzZXQgLUVldW8gcGlwZWZhaWwKdW1hc2sgMDc3CnNvdXJjZSAiJChkaXJuYW1lICIke0JBU0hfU09VUkNFWzBdfSIpL3ByZXZpZXctcmVsZWFzZS1saWIuc2giCmRlcGxveV9yb290PSR7MTo/ZGVwbG95IHJvb3QgaXMgcmVxdWlyZWR9CmltYWdlX3JlZj0kezI6P2ltYWdlIHJlZmVyZW5jZSBpcyByZXF1aXJlZH0KcmVsZWFzZV9zaGE9JHszOj9yZWxlYXNlIHNoYSBpcyByZXF1aXJlZH0KcHJveHlfbmV0d29yaz0kezQ6P3Byb3h5IG5ldHdvcmsgaXMgcmVxdWlyZWR9CmNvbXBvc2VfcHJvamVjdD0kezU6P2NvbXBvc2UgcHJvamVjdCBpcyByZXF1aXJlZH0KW1sgIiRkZXBsb3lfcm9vdCIgPX4gXi9bQS1aYS16MC05Ll8vLV0rJCBdXQpbWyAiJHJlbGVhc2Vfc2hhIiA9fiBeWzAtOWEtZl17NDB9JCBdXQpbWyAiJGltYWdlX3JlZiIgPSAiYmxhZ292YS1zd2VldHMtcHJldmlldzokcmVsZWFzZV9zaGEiIF1dCltbICIkcHJveHlfbmV0d29yayIgPX4gXltBLVphLXowLTkuXy1dKyQgXV0KW1sgIiRjb21wb3NlX3Byb2plY3QiID1+IF5bYS16MC05XVthLXowLTlfLV0rJCBdXQpyZWxlYXNlX2Rpcj0iJGRlcGxveV9yb290L3JlbGVhc2VzLyRyZWxlYXNlX3NoYSIKc3RhdGVfZGlyPSIkZGVwbG95X3Jvb3Qvc3RhdGUiCmJhY2t1cHNfZGlyPSIkZGVwbG95X3Jvb3QvYmFja3VwcyIKY29tcG9zZV9maWxlPSIkZGVwbG95X3Jvb3QvZG9ja2VyLWNvbXBvc2UucHJldmlldy55bWwiCmVudl9maWxlPSIkZGVwbG95X3Jvb3QvLmVudiIKcHJldmlvdXNfY29tcG9zZT0iJHN0YXRlX2Rpci9kb2NrZXItY29tcG9zZS5wcmV2aW91cy55bWwiCnByZXZpb3VzX2Vudj0iJHN0YXRlX2Rpci9lbnYucHJldmlvdXMiCmluY29taW5nX2NvbXBvc2U9IiRyZWxlYXNlX2Rpci9kb2NrZXItY29tcG9zZS5wcmV2aWV3LnltbCIKaW1hZ2VfYXJjaGl2ZT0iJHJlbGVhc2VfZGlyL3ByZXZpZXctaW1hZ2UudGFyLmd6IgpsZWdhY3lfbmFtZT1ibGFnb3ZhLXN3ZWV0cy1wcmV2aWV3CmxlZ2FjeV9iYWNrdXBfbmFtZT0KbGVnYWN5X2ltYWdlX2lkPQpoYWRfcHJldmlvdXM9ZmFsc2UKaGFkX2xlZ2FjeT1mYWxzZQptdXRhdGlvbl9zdGFydGVkPWZhbHNlCm9wZXJhdGlvbl9jb21wbGV0ZT1mYWxzZQpydW50aW1lX21heV9oYXZlX2NoYW5nZWQ9ZmFsc2UKdGltZXN0YW1wPSQoZGF0ZSAtdSArJVklbSVkLSVIJU0lUykKaW5zdGFsbCAtZCAtbSA3NTAgIiRkZXBsb3lfcm9vdCIgIiRkZXBsb3lfcm9vdC9yZWxlYXNlcyIgIiRzdGF0ZV9kaXIiICIkYmFja3Vwc19kaXIiCmV4ZWMgOT4iJGRlcGxveV9yb290Ly5kZXBsb3kubG9jayIKZmxvY2sgLW4gOSB8fCB7IGVjaG8gJ0Fub3RoZXIgcHJldmlldyBkZXBsb3ltZW50IGlzIHJ1bm5pbmcuJyA+JjI7IGV4aXQgMTsgfQppZiBbIC1lICIkc3RhdGVfZGlyL3JlY292ZXJ5LXJlcXVpcmVkIiBdIHx8IFsgLWUgIiRzdGF0ZV9kaXIvb3BlcmF0aW9uLWluLXByb2dyZXNzIiBdOyB0aGVuCiAgZWNobyAnVW5yZXNvbHZlZCBQcmV2aWV3IG9wZXJhdGlvbjsgaW5zcGVjdCBzdGF0ZSBiZWZvcmUgcmV0cnlpbmcuJyA+JjIKICBleGl0IDEKZmkKdGVzdCAtcyAiJGluY29taW5nX2NvbXBvc2UiCnRlc3QgLXMgIiRpbWFnZV9hcmNoaXZlIgpkb2NrZXIgbmV0d29yayBpbnNwZWN0ICIkcHJveHlfbmV0d29yayIgPi9kZXYvbnVsbAp0cmFuc2FjdGlvbj0kKG1rdGVtcCAtZCAiJHN0YXRlX2Rpci9kZXBsb3ktdHJhbnNhY3Rpb24uWFhYWFhYWFgiKQpwcmV2aWV3X3NuYXBzaG90X3BvaW50ZXJzCmlmIFsgLWUgIiRjb21wb3NlX2ZpbGUiIF0gfHwgWyAtZSAiJGVudl9maWxlIiBdOyB0aGVuCiAgdGVzdCAtcyAiJGNvbXBvc2VfZmlsZSIKICB0ZXN0IC1zICIkZW52X2ZpbGUiCiAgWyAiJChwcmV2aWV3X3Byb2plY3QgIiRlbnZfZmlsZSIpIiA9ICIkY29tcG9zZV9wcm9qZWN0IiBdCiAgcHJldmlld19pbWFnZSAiJGVudl9maWxlIiA+L2Rldi9udWxsCiAgcHJldmlld19zbmFwc2hvdAogIGhhZF9wcmV2aW91cz10cnVlCmVsaWYgZG9ja2VyIGluc3BlY3QgIiRsZWdhY3lfbmFtZSIgPi9kZXYvbnVsbCAyPiYxOyB0aGVuCiAgaGFkX2xlZ2FjeT10cnVlCiAgbGVnYWN5X2ltYWdlX2lkPSQoZG9ja2VyIGluc3BlY3QgLS1mb3JtYXQgJ3t7LkltYWdlfX0nICIkbGVnYWN5X25hbWUiKQpmaQpjb21wb3NlPShkb2NrZXIgY29tcG9zZSAtLXByb2plY3QtbmFtZSAiJGNvbXBvc2VfcHJvamVjdCIgLS1lbnYtZmlsZSAiJGVudl9maWxlIiAtZiAiJGNvbXBvc2VfZmlsZSIpCnByZXZpZXdfcmVjb3ZlcigpIHsKICBpZiBbICIkaGFkX3ByZXZpb3VzIiA9IHRydWUgXTsgdGhlbgogICAgcHJldmlld19yZXN0b3JlX21hbmFnZWQgfHwgcmV0dXJuCiAgZWxpZiBbICIkaGFkX2xlZ2FjeSIgPSB0cnVlIF07IHRoZW4KICAgIGlmIFsgIiRydW50aW1lX21heV9oYXZlX2NoYW5nZWQiID0gdHJ1ZSBdOyB0aGVuICIke2NvbXBvc2VbQF19IiBkb3duIC0tcmVtb3ZlLW9ycGhhbnMgfHwgcmV0dXJuOyBmaQogICAgaWYgWyAtbiAiJGxlZ2FjeV9iYWNrdXBfbmFtZSIgXSAmJiBkb2NrZXIgaW5zcGVjdCAiJGxlZ2FjeV9iYWNrdXBfbmFtZSIgPi9kZXYvbnVsbCAyPiYxOyB0aGVuCiAgICAgIGRvY2tlciByZW5hbWUgIiRsZWdhY3lfYmFja3VwX25hbWUiICIkbGVnYWN5X25hbWUiIHx8IHJldHVybgogICAgZmkKICAgIGRvY2tlciBzdGFydCAiJGxlZ2FjeV9uYW1lIiA+L2Rldi9udWxsIHx8IHJldHVybgogICAgcHJldmlld193YWl0ICIkbGVnYWN5X25hbWUiIHRydWUgfHwgcmV0dXJuCiAgICBbICIkKGRvY2tlciBpbnNwZWN0IC0tZm9ybWF0ICd7ey5JbWFnZX19JyAiJGxlZ2FjeV9uYW1lIikiID0gIiRsZWdhY3lfaW1hZ2VfaWQiIF0gfHwgcmV0dXJuIDEKICAgIHByZXZpZXdfcmVzdG9yZV9wb2ludGVycyB8fCByZXR1cm4KICAgIHJtIC1mICIkY29tcG9zZV9maWxlIiAiJGVudl9maWxlIiAiJHN0YXRlX2Rpci9jdXJyZW50LXJlbGVhc2UiICIkc3RhdGVfZGlyL2xlZ2FjeS1jb250YWluZXIiICIkc3RhdGVfZGlyL2xlZ2FjeS1pbWFnZSIgfHwgcmV0dXJuCiAgICBwcmV2aWV3X2F0b21pY190ZXh0ICIkc3RhdGVfZGlyL2xlZ2FjeS1jb250YWluZXIucmVzdG9yZWQiICIkbGVnYWN5X25hbWUiIHx8IHJldHVybgogIGVsc2UKICAgIGlmIFsgIiRydW50aW1lX21heV9oYXZlX2NoYW5nZWQiID0gdHJ1ZSBdOyB0aGVuICIke2NvbXBvc2VbQF19IiBkb3duIC0tcmVtb3ZlLW9ycGhhbnMgfHwgcmV0dXJuOyBmaQogICAgcHJldmlld19yZXN0b3JlX3BvaW50ZXJzIHx8IHJldHVybgogICAgcm0gLWYgIiRjb21wb3NlX2ZpbGUiICIkZW52X2ZpbGUiICIkc3RhdGVfZGlyL2N1cnJlbnQtcmVsZWFzZSIgfHwgcmV0dXJuCiAgICBlY2hvICdObyBwcmV2aW91cyBQcmV2aWV3IHJlbGVhc2UgZXhpc3RlZDsgZW1wdHkgYmFzZWxpbmUgcmVzdG9yZWQuJyA+JjIKICBmaQp9CnRyYXAgJ3ByZXZpZXdfZmluaXNoICQ/JyBFWElUCnRyYXAgJ2V4aXQgMTMwJyBJTlQKdHJhcCAnZXhpdCAxNDMnIFRFUk0KIyBMb2FkaW5nIGFuIGltYWdlIGRvZXMgbm90IHN3aXRjaCBydW50aW1lLiBBcm0gcmVjb3ZlcnkgYmVmb3JlIGNvbmZpZyB3cml0ZXMuCmd6aXAgLWRjICIkaW1hZ2VfYXJjaGl2ZSIgfCBkb2NrZXIgbG9hZCA+L2Rldi9udWxsCnByZXZpZXdfYXRvbWljX3RleHQgIiRzdGF0ZV9kaXIvb3BlcmF0aW9uLWluLXByb2dyZXNzIiAiZGVwbG95OiRyZWxlYXNlX3NoYSIKbXV0YXRpb25fc3RhcnRlZD10cnVlCmluc3RhbGwgLW0gNjQwICIkaW5jb21pbmdfY29tcG9zZSIgIiRjb21wb3NlX2ZpbGUiCmVudl90bXA9IiRzdGF0ZV9kaXIvZW52Lm5leHQiCnByaW50ZiAnUFJFVklFV19JTUFHRT0lc1xuUFJFVklFV19QUk9YWV9ORVRXT1JLPSVzXG5QUkVWSUVXX0NPTVBPU0VfUFJPSkVDVD0lc1xuJyAiJGltYWdlX3JlZiIgIiRwcm94eV9uZXR3b3JrIiAiJGNvbXBvc2VfcHJvamVjdCIgPiAiJGVudl90bXAiCmNobW9kIDY0MCAiJGVudl90bXAiCm12ICIkZW52X3RtcCIgIiRlbnZfZmlsZSIKaWYgWyAiJGhhZF9sZWdhY3kiID0gdHJ1ZSBdOyB0aGVuCiAgbGVnYWN5X2JhY2t1cF9uYW1lPSIke2xlZ2FjeV9uYW1lfS1sZWdhY3ktJHt0aW1lc3RhbXB9IgogIGxlZ2FjeV90YWc9ImJsYWdvdmEtc3dlZXRzLXByZXZpZXc6bGVnYWN5LSR7dGltZXN0YW1wfSIKICBkb2NrZXIgaW5zcGVjdCAiJGxlZ2FjeV9uYW1lIiA+ICIkYmFja3Vwc19kaXIvJHt0aW1lc3RhbXB9LWxlZ2FjeS1jb250YWluZXIuanNvbiIKICBkb2NrZXIgaW1hZ2UgaW5zcGVjdCAiJGxlZ2FjeV9pbWFnZV9pZCIgPiAiJGJhY2t1cHNfZGlyLyR7dGltZXN0YW1wfS1sZWdhY3ktaW1hZ2UuanNvbiIKICBkb2NrZXIgdGFnICIkbGVnYWN5X2ltYWdlX2lkIiAiJGxlZ2FjeV90YWciCiAgZG9ja2VyIHNhdmUgIiRsZWdhY3lfdGFnIiB8IGd6aXAgLTkgPiAiJGJhY2t1cHNfZGlyLyR7dGltZXN0YW1wfS1sZWdhY3ktaW1hZ2UudGFyLmd6LnRtcCIKICBtdiAiJGJhY2t1cHNfZGlyLyR7dGltZXN0YW1wfS1sZWdhY3ktaW1hZ2UudGFyLmd6LnRtcCIgIiRiYWNrdXBzX2Rpci8ke3RpbWVzdGFtcH0tbGVnYWN5LWltYWdlLnRhci5neiIKICBkb2NrZXIgc3RvcCAtLXRpbWUgMzAgIiRsZWdhY3lfbmFtZSIgPi9kZXYvbnVsbAogIGRvY2tlciByZW5hbWUgIiRsZWdhY3lfbmFtZSIgIiRsZWdhY3lfYmFja3VwX25hbWUiCiAgcHJldmlld19hdG9taWNfdGV4dCAiJHN0YXRlX2Rpci9sZWdhY3ktY29udGFpbmVyIiAiJGxlZ2FjeV9iYWNrdXBfbmFtZSIKICBwcmV2aWV3X2F0b21pY190ZXh0ICIkc3RhdGVfZGlyL2xlZ2FjeS1pbWFnZSIgIiRsZWdhY3lfdGFnIgpmaQpydW50aW1lX21heV9oYXZlX2NoYW5nZWQ9dHJ1ZQoiJHtjb21wb3NlW0BdfSIgdXAgLWQgLS1uby1idWlsZCAtLXJlbW92ZS1vcnBoYW5zCmNvbnRhaW5lcl9pZD0kKCIke2NvbXBvc2VbQF19IiBwcyAtcSBzdG9yZWZyb250KQp0ZXN0IC1uICIkY29udGFpbmVyX2lkIgpwcmV2aWV3X3dhaXQgIiRjb250YWluZXJfaWQiCnByZXZpZXdfdmVyaWZ5X2ltYWdlICIkY29udGFpbmVyX2lkIiAiJGltYWdlX3JlZiIKaWYgWyAiJGhhZF9wcmV2aW91cyIgPSB0cnVlIF07IHRoZW4KICBjcCAtcCAiJHRyYW5zYWN0aW9uL2RvY2tlci1jb21wb3NlLnByZXZpZXcueW1sIiAiJHByZXZpb3VzX2NvbXBvc2UiCiAgY3AgLXAgIiR0cmFuc2FjdGlvbi8uZW52IiAiJHByZXZpb3VzX2VudiIKZmkKcHJldmlld19hdG9taWNfdGV4dCAiJHN0YXRlX2Rpci9jdXJyZW50LXJlbGVhc2UiICIkcmVsZWFzZV9zaGEiCnJtIC1mICIkc3RhdGVfZGlyL3JlY292ZXJ5LXJlcXVpcmVkIiAiJHN0YXRlX2Rpci9sZWdhY3ktY29udGFpbmVyLnJlc3RvcmVkIgpvcGVyYXRpb25fY29tcGxldGU9dHJ1ZQplY2hvICJQcmV2aWV3IHJlbGVhc2UgJHJlbGVhc2Vfc2hhIGlzIGhlYWx0aHkuIgo='}, 'rollback-preview.sh': {'sha256': '31af876c52518458003d72fbfa3d45ed727dcdddb9e4fecfd3e790c577563ceb', 'base64': 'IyEvdXNyL2Jpbi9lbnYgYmFzaApzZXQgLUVldW8gcGlwZWZhaWwKdW1hc2sgMDc3CnNvdXJjZSAiJChkaXJuYW1lICIke0JBU0hfU09VUkNFWzBdfSIpL3ByZXZpZXctcmVsZWFzZS1saWIuc2giCmRlcGxveV9yb290PSR7MTotL29wdC9ibGFnb3ZhLXN3ZWV0cy1wcmV2aWV3fQpbWyAiJGRlcGxveV9yb290IiA9fiBeL1tBLVphLXowLTkuXy8tXSskIF1dCnN0YXRlX2Rpcj0iJGRlcGxveV9yb290L3N0YXRlIgpjb21wb3NlX2ZpbGU9IiRkZXBsb3lfcm9vdC9kb2NrZXItY29tcG9zZS5wcmV2aWV3LnltbCIKZW52X2ZpbGU9IiRkZXBsb3lfcm9vdC8uZW52IgpwcmV2aW91c19jb21wb3NlPSIkc3RhdGVfZGlyL2RvY2tlci1jb21wb3NlLnByZXZpb3VzLnltbCIKcHJldmlvdXNfZW52PSIkc3RhdGVfZGlyL2Vudi5wcmV2aW91cyIKbGVnYWN5X3N0YXRlPSIkc3RhdGVfZGlyL2xlZ2FjeS1jb250YWluZXIiCm11dGF0aW9uX3N0YXJ0ZWQ9ZmFsc2UKb3BlcmF0aW9uX2NvbXBsZXRlPWZhbHNlCmxlZ2FjeV9yZW5hbWVkPWZhbHNlCmV4ZWMgOT4iJGRlcGxveV9yb290Ly5kZXBsb3kubG9jayIKZmxvY2sgLW4gOSB8fCB7IGVjaG8gJ0Fub3RoZXIgcHJldmlldyBkZXBsb3ltZW50IGlzIHJ1bm5pbmcuJyA+JjI7IGV4aXQgMTsgfQppZiBbIC1lICIkc3RhdGVfZGlyL3JlY292ZXJ5LXJlcXVpcmVkIiBdIHx8IFsgLWUgIiRzdGF0ZV9kaXIvb3BlcmF0aW9uLWluLXByb2dyZXNzIiBdOyB0aGVuCiAgZWNobyAnVW5yZXNvbHZlZCBQcmV2aWV3IG9wZXJhdGlvbjsgaW5zcGVjdCBzdGF0ZSBiZWZvcmUgcmV0cnlpbmcuJyA+JjIKICBleGl0IDEKZmkKdGVzdCAtcyAiJGNvbXBvc2VfZmlsZSIKdGVzdCAtcyAiJGVudl9maWxlIgpjdXJyZW50X2ltYWdlPSQocHJldmlld19pbWFnZSAiJGVudl9maWxlIikKY3VycmVudF9wcm9qZWN0PSQocHJldmlld19wcm9qZWN0ICIkZW52X2ZpbGUiKQp0cmFuc2FjdGlvbj0kKG1rdGVtcCAtZCAiJHN0YXRlX2Rpci9yb2xsYmFjay10cmFuc2FjdGlvbi5YWFhYWFhYWCIpCnByZXZpZXdfc25hcHNob3QKcHJldmlld19zbmFwc2hvdF9wb2ludGVycwpjb21wb3NlPShkb2NrZXIgY29tcG9zZSAtLXByb2plY3QtbmFtZSAiJGN1cnJlbnRfcHJvamVjdCIgLS1lbnYtZmlsZSAiJGVudl9maWxlIiAtZiAiJGNvbXBvc2VfZmlsZSIpCnByZXZpZXdfcmVjb3ZlcigpIHsKICBpZiBbICIkbGVnYWN5X3JlbmFtZWQiID0gdHJ1ZSBdOyB0aGVuCiAgICBkb2NrZXIgc3RvcCAtLXRpbWUgMzAgYmxhZ292YS1zd2VldHMtcHJldmlldyA+L2Rldi9udWxsIHx8IHJldHVybgogICAgZG9ja2VyIHJlbmFtZSBibGFnb3ZhLXN3ZWV0cy1wcmV2aWV3ICIkbGVnYWN5X25hbWUiIHx8IHJldHVybgogIGZpCiAgcHJldmlld19yZXN0b3JlX21hbmFnZWQgfHwgcmV0dXJuCn0KdHJhcCAncHJldmlld19maW5pc2ggJD8nIEVYSVQKdHJhcCAnZXhpdCAxMzAnIElOVAp0cmFwICdleGl0IDE0MycgVEVSTQppZiBbICEgLXMgIiRwcmV2aW91c19jb21wb3NlIiBdIHx8IFsgISAtcyAiJHByZXZpb3VzX2VudiIgXTsgdGhlbgogICMgQSBoYWxmIHBvaW50ZXIgcGFpciBpcyBjb3JydXB0aW9uLCBub3QgcGVybWlzc2lvbiB0byBmYWxsIGJhY2sgdG8gbGVnYWN5LgogIFsgISAtZSAiJHByZXZpb3VzX2NvbXBvc2UiIF0KICBbICEgLWUgIiRwcmV2aW91c19lbnYiIF0KICB0ZXN0IC1zICIkbGVnYWN5X3N0YXRlIgogIGxlZ2FjeV9uYW1lPSQoY2F0ICIkbGVnYWN5X3N0YXRlIikKICBbWyAiJGxlZ2FjeV9uYW1lIiA9fiBeYmxhZ292YS1zd2VldHMtcHJldmlldy1sZWdhY3ktWzAtOV17OH0tWzAtOV17Nn0kIF1dCiAgbGVnYWN5X2ltYWdlX2lkPSQoZG9ja2VyIGluc3BlY3QgLS1mb3JtYXQgJ3t7LkltYWdlfX0nICIkbGVnYWN5X25hbWUiKQogIHByZXZpZXdfYXRvbWljX3RleHQgIiRzdGF0ZV9kaXIvb3BlcmF0aW9uLWluLXByb2dyZXNzIiAncm9sbGJhY2s6bGVnYWN5JwogIG11dGF0aW9uX3N0YXJ0ZWQ9dHJ1ZQogICIke2NvbXBvc2VbQF19IiBkb3duIC0tcmVtb3ZlLW9ycGhhbnMKICBkb2NrZXIgcmVuYW1lICIkbGVnYWN5X25hbWUiIGJsYWdvdmEtc3dlZXRzLXByZXZpZXcKICBsZWdhY3lfcmVuYW1lZD10cnVlCiAgZG9ja2VyIHN0YXJ0IGJsYWdvdmEtc3dlZXRzLXByZXZpZXcgPi9kZXYvbnVsbAogIHByZXZpZXdfd2FpdCBibGFnb3ZhLXN3ZWV0cy1wcmV2aWV3IHRydWUKICBbICIkKGRvY2tlciBpbnNwZWN0IC0tZm9ybWF0ICd7ey5JbWFnZX19JyBibGFnb3ZhLXN3ZWV0cy1wcmV2aWV3KSIgPSAiJGxlZ2FjeV9pbWFnZV9pZCIgXQogIHByZXZpZXdfYXRvbWljX3RleHQgIiRzdGF0ZV9kaXIvbGVnYWN5LWNvbnRhaW5lci5yZXN0b3JlZCIgIiRsZWdhY3lfbmFtZSIKICAjIExlZ2FjeSBoYXMgbm8gdmVyaWZpZWQgR2l0IFNIQS4gUmVjb3JkIGl0IHNlcGFyYXRlbHkgZnJvbSBtYW5hZ2VkIHJlbGVhc2VzLgogIHJtIC1mICIkY29tcG9zZV9maWxlIiAiJGVudl9maWxlIiAiJHN0YXRlX2Rpci9jdXJyZW50LXJlbGVhc2UiICIkbGVnYWN5X3N0YXRlIiAiJHN0YXRlX2Rpci9yZWNvdmVyeS1yZXF1aXJlZCIKICBvcGVyYXRpb25fY29tcGxldGU9dHJ1ZQogIGVjaG8gJ1ByZXZpZXcgcm9sbGJhY2sgcmVzdG9yZWQgdGhlIHByZXNlcnZlZCBsZWdhY3kgY29udGFpbmVyLicKICBleGl0IDAKZmkKdGFyZ2V0X2ltYWdlPSQocHJldmlld19pbWFnZSAiJHByZXZpb3VzX2VudiIpClsgIiQocHJldmlld19wcm9qZWN0ICIkcHJldmlvdXNfZW52IikiID0gIiRjdXJyZW50X3Byb2plY3QiIF0KcHJldmlld19hdG9taWNfdGV4dCAiJHN0YXRlX2Rpci9vcGVyYXRpb24taW4tcHJvZ3Jlc3MiICJyb2xsYmFjazoke3RhcmdldF9pbWFnZSMjKjp9IgptdXRhdGlvbl9zdGFydGVkPXRydWUKY3AgLXAgIiRwcmV2aW91c19jb21wb3NlIiAiJGNvbXBvc2VfZmlsZSIKY3AgLXAgIiRwcmV2aW91c19lbnYiICIkZW52X2ZpbGUiCiIke2NvbXBvc2VbQF19IiB1cCAtZCAtLW5vLWJ1aWxkIC0tcmVtb3ZlLW9ycGhhbnMKY29udGFpbmVyX2lkPSQoIiR7Y29tcG9zZVtAXX0iIHBzIC1xIHN0b3JlZnJvbnQpCnRlc3QgLW4gIiRjb250YWluZXJfaWQiCnByZXZpZXdfd2FpdCAiJGNvbnRhaW5lcl9pZCIKcHJldmlld192ZXJpZnlfaW1hZ2UgIiRjb250YWluZXJfaWQiICIkdGFyZ2V0X2ltYWdlIgpjcCAtcCAiJHRyYW5zYWN0aW9uL2RvY2tlci1jb21wb3NlLnByZXZpZXcueW1sIiAiJHByZXZpb3VzX2NvbXBvc2UiCmNwIC1wICIkdHJhbnNhY3Rpb24vLmVudiIgIiRwcmV2aW91c19lbnYiCnByZXZpZXdfYXRvbWljX3RleHQgIiRzdGF0ZV9kaXIvY3VycmVudC1yZWxlYXNlIiAiJHt0YXJnZXRfaW1hZ2UjIyo6fSIKcm0gLWYgIiRzdGF0ZV9kaXIvcmVjb3ZlcnktcmVxdWlyZWQiICIkc3RhdGVfZGlyL2xlZ2FjeS1jb250YWluZXIucmVzdG9yZWQiCm9wZXJhdGlvbl9jb21wbGV0ZT10cnVlCmVjaG8gJ1ByZXZpZXcgcm9sbGJhY2sgY29tcGxldGVkIGFuZCBpcyBoZWFsdGh5LicK'}, 'preview-release-lib.sh': {'sha256': '7303478b54ccff4f5eb913064f2187c46535a4838a203019f9b8bfe79fd325c1', 'base64': 'IyEvdXNyL2Jpbi9lbnYgYmFzaAojIFNvdXJjZWQgYnkgdGhlIHN0YW5kYWxvbmUgUHJldmlldyBzY3JpcHRzOyBubyBEb2NrZXIvbmV0d29yayBjYWxscyBvbiBsb2FkLgpwcmV2aWV3X2ltYWdlKCkgewogIGxvY2FsIHZhbHVlCiAgdmFsdWU9JChzZWQgLW4gJ3MvXlBSRVZJRVdfSU1BR0U9Ly9wJyAiJDEiKSB8fCByZXR1cm4KICBbWyAiJHZhbHVlIiA9fiBeYmxhZ292YS1zd2VldHMtcHJldmlldzpbMC05YS1mXXs0MH0kIF1dIHx8IHJldHVybiAxCiAgcHJpbnRmICclc1xuJyAiJHZhbHVlIgp9CnByZXZpZXdfcHJvamVjdCgpIHsKICBsb2NhbCB2YWx1ZQogIHZhbHVlPSQoc2VkIC1uICdzL15QUkVWSUVXX0NPTVBPU0VfUFJPSkVDVD0vL3AnICIkMSIpIHx8IHJldHVybgogIFtbICIkdmFsdWUiID1+IF5bYS16MC05XVthLXowLTlfLV0rJCBdXSB8fCByZXR1cm4gMQogIHByaW50ZiAnJXNcbicgIiR2YWx1ZSIKfQpwcmV2aWV3X3dhaXQoKSB7CiAgbG9jYWwgY29udGFpbmVyPSQxIGFsbG93X3J1bm5pbmc9JHsyOi1mYWxzZX0gc3RhdHVzIGF0dGVtcHQKICBmb3IgYXR0ZW1wdCBpbiAkKHNlcSAxIDQ1KTsgZG8KICAgIHN0YXR1cz0kKGRvY2tlciBpbnNwZWN0IC0tZm9ybWF0ICd7e2lmIC5TdGF0ZS5IZWFsdGh9fXt7LlN0YXRlLkhlYWx0aC5TdGF0dXN9fXt7ZWxzZX19e3suU3RhdGUuU3RhdHVzfX17e2VuZH19JyAiJGNvbnRhaW5lciIpIHx8IHJldHVybiAxCiAgICBjYXNlICIkc3RhdHVzIiBpbgogICAgICBoZWFsdGh5KSByZXR1cm4gMCA7OwogICAgICBydW5uaW5nKSBpZiBbICIkYWxsb3dfcnVubmluZyIgPSB0cnVlIF07IHRoZW4gcmV0dXJuIDA7IGZpIDs7CiAgICAgIHVuaGVhbHRoeXxleGl0ZWR8ZGVhZCkgcmV0dXJuIDEgOzsKICAgIGVzYWMKICAgIHNsZWVwIDIgfHwgcmV0dXJuIDEKICBkb25lCiAgZWNobyAnUHJldmlldyBoZWFsdGggY2hlY2sgdGltZWQgb3V0LicgPiYyCiAgcmV0dXJuIDEKfQpwcmV2aWV3X3ZlcmlmeV9pbWFnZSgpIHsKICBsb2NhbCBhY3R1YWwKICBhY3R1YWw9JChkb2NrZXIgaW5zcGVjdCAtLWZvcm1hdCAne3suQ29uZmlnLkltYWdlfX0nICIkMSIpIHx8IHJldHVybiAxCiAgWyAiJGFjdHVhbCIgPSAiJDIiIF0KfQpwcmV2aWV3X2F0b21pY190ZXh0KCkgewogIGxvY2FsIGRlc3RpbmF0aW9uPSQxIHZhbHVlPSQyCiAgcHJpbnRmICclc1xuJyAiJHZhbHVlIiA+ICIkZGVzdGluYXRpb24ubmV4dCIgfHwgcmV0dXJuCiAgbXYgLWYgIiRkZXN0aW5hdGlvbi5uZXh0IiAiJGRlc3RpbmF0aW9uIgp9CnByZXZpZXdfc25hcHNob3QoKSB7CiAgbG9jYWwgZmlsZQogIGZvciBmaWxlIGluIGRvY2tlci1jb21wb3NlLnByZXZpZXcueW1sIC5lbnY7IGRvCiAgICBjcCAtcCAiJGRlcGxveV9yb290LyRmaWxlIiAiJHRyYW5zYWN0aW9uLyRmaWxlIiB8fCByZXR1cm4KICBkb25lCn0KIyBTbmFwc2hvdCBwcmV2aW91cyBwb2ludGVycyB0b286IGZhaWxlZCByb3RhdGlvbiBtdXN0IG5vdCBsZWF2ZSBhIG1peGVkIHBhaXIuCnByZXZpZXdfc25hcHNob3RfcG9pbnRlcnMoKSB7CiAgbG9jYWwgZmlsZQogIGZvciBmaWxlIGluIGRvY2tlci1jb21wb3NlLnByZXZpb3VzLnltbCBlbnYucHJldmlvdXM7IGRvCiAgICBpZiBbIC1lICIkc3RhdGVfZGlyLyRmaWxlIiBdOyB0aGVuIGNwIC1wICIkc3RhdGVfZGlyLyRmaWxlIiAiJHRyYW5zYWN0aW9uLyRmaWxlIiB8fCByZXR1cm47IGZpCiAgZG9uZQp9CnByZXZpZXdfcmVzdG9yZV9wb2ludGVycygpIHsKICBsb2NhbCBmaWxlCiAgZm9yIGZpbGUgaW4gZG9ja2VyLWNvbXBvc2UucHJldmlvdXMueW1sIGVudi5wcmV2aW91czsgZG8KICAgIGlmIFsgLWUgIiR0cmFuc2FjdGlvbi8kZmlsZSIgXTsgdGhlbgogICAgICBjcCAtcCAiJHRyYW5zYWN0aW9uLyRmaWxlIiAiJHN0YXRlX2Rpci8kZmlsZSIgfHwgcmV0dXJuCiAgICBlbHNlCiAgICAgIHJtIC1mICIkc3RhdGVfZGlyLyRmaWxlIiB8fCByZXR1cm4KICAgIGZpCiAgZG9uZQp9CnByZXZpZXdfcmVzdG9yZV9tYW5hZ2VkKCkgewogIGNwIC1wICIkdHJhbnNhY3Rpb24vZG9ja2VyLWNvbXBvc2UucHJldmlldy55bWwiICIkY29tcG9zZV9maWxlIiB8fCByZXR1cm4KICBjcCAtcCAiJHRyYW5zYWN0aW9uLy5lbnYiICIkZW52X2ZpbGUiIHx8IHJldHVybgogIGxvY2FsIGltYWdlIHByb2plY3QgY29udGFpbmVyCiAgaW1hZ2U9JChwcmV2aWV3X2ltYWdlICIkZW52X2ZpbGUiKSB8fCByZXR1cm4KICBwcm9qZWN0PSQocHJldmlld19wcm9qZWN0ICIkZW52X2ZpbGUiKSB8fCByZXR1cm4KICBsb2NhbCByZXN0b3JlZD0oZG9ja2VyIGNvbXBvc2UgLS1wcm9qZWN0LW5hbWUgIiRwcm9qZWN0IiAtLWVudi1maWxlICIkZW52X2ZpbGUiIC1mICIkY29tcG9zZV9maWxlIikKICAiJHtyZXN0b3JlZFtAXX0iIHVwIC1kIC0tbm8tYnVpbGQgLS1yZW1vdmUtb3JwaGFucyB8fCByZXR1cm4KICBjb250YWluZXI9JCgiJHtyZXN0b3JlZFtAXX0iIHBzIC1xIHN0b3JlZnJvbnQpIHx8IHJldHVybgogIFsgLW4gIiRjb250YWluZXIiIF0gfHwgcmV0dXJuIDEKICBwcmV2aWV3X3dhaXQgIiRjb250YWluZXIiIHx8IHJldHVybgogIHByZXZpZXdfdmVyaWZ5X2ltYWdlICIkY29udGFpbmVyIiAiJGltYWdlIiB8fCByZXR1cm4KICBwcmV2aWV3X3Jlc3RvcmVfcG9pbnRlcnMgfHwgcmV0dXJuCiAgcHJldmlld19hdG9taWNfdGV4dCAiJHN0YXRlX2Rpci9jdXJyZW50LXJlbGVhc2UiICIke2ltYWdlIyMqOn0iIHx8IHJldHVybgp9CiMgRVhJVCBoYW5kbGVzIGV4cGxpY2l0IGV4aXQgYW5kIGNvbW1hbmQgZmFpbHVyZS4gRGlzYWJsZSB0cmFwcyBiZWZvcmUgcmVjb3ZlcnkKIyBzbyByZWNvdmVyeSBmYWlsdXJlIGNhbm5vdCByZWN1cnNpdmVseSBpbnZva2UgaXQuIEVhY2ggcmVjb3Zlcnkgc3RlcCBjaGVja3MgUkMuCnByZXZpZXdfZmluaXNoKCkgewogIGxvY2FsIHN0YXR1cz0kMQogIHRyYXAgLSBFWElUIElOVCBURVJNCiAgc2V0ICtlCiAgaWYgWyAiJG9wZXJhdGlvbl9jb21wbGV0ZSIgIT0gdHJ1ZSBdICYmIFsgIiRtdXRhdGlvbl9zdGFydGVkIiA9IHRydWUgXTsgdGhlbgogICAgZWNobyAnUHJldmlldyBvcGVyYXRpb24gZmFpbGVkOyBhdHRlbXB0aW5nIG9uZSByZWNvdmVyeS4nID4mMgogICAgaWYgcHJldmlld19yZWNvdmVyOyB0aGVuCiAgICAgIHJtIC1mICIkc3RhdGVfZGlyL3JlY292ZXJ5LXJlcXVpcmVkIgogICAgICBlY2hvICdQcmV2aW91cyBQcmV2aWV3IHJ1bnRpbWUgcmVzdG9yZWQgYW5kIHZlcmlmaWVkLicgPiYyCiAgICBlbHNlCiAgICAgIHJtIC1mICIkc3RhdGVfZGlyL2N1cnJlbnQtcmVsZWFzZSIKICAgICAgcHJldmlld19hdG9taWNfdGV4dCAiJHN0YXRlX2Rpci9yZWNvdmVyeS1yZXF1aXJlZCIgJ1JlY292ZXJ5IGZhaWxlZDsgaW5zcGVjdCBydW50aW1lIGJlZm9yZSBhbnkgZnVydGhlciByZWxlYXNlIG9wZXJhdGlvbi4nCiAgICAgIGVjaG8gJ1ByZXZpZXcgcmVjb3ZlcnkgZmFpbGVkOyBtYW51YWwgaW5zcGVjdGlvbiByZXF1aXJlZC4gTm8gaGVhbHRoeSByZWxlYXNlIG1hcmtlciBpcyBjbGFpbWVkLicgPiYyCiAgICBmaQogICAgWyAiJHN0YXR1cyIgLW5lIDAgXSB8fCBzdGF0dXM9MQogIGZpCiAgaWYgWyAiJG11dGF0aW9uX3N0YXJ0ZWQiID0gdHJ1ZSBdOyB0aGVuIHJtIC1mICIkc3RhdGVfZGlyL29wZXJhdGlvbi1pbi1wcm9ncmVzcyI7IGZpCiAgIyBQcml2YXRlIHRyYW5zYWN0aW9uIHNuYXBzaG90cyBhcmUgcmV0YWluZWQgZm9yIGRpYWdub3Npczsgbm8gZW52IGlzIHByaW50ZWQuCiAgZXhpdCAiJHN0YXR1cyIKfQo='}}

def require(ok, message):
    if not ok:
        raise RuntimeError(message)

def sha(path,limit=None):
    h = hashlib.sha256()
    total=0
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            total+=len(chunk)
            require(limit is None or total <= limit,'archive compressed hash budget exceeded')
            h.update(chunk)
    return h.hexdigest()

def copy_archive_bounded(source, destination, limit=MAX_COMPRESSED):
    # Reject before creating a destination, then enforce the cap on actual bytes.
    require(source.stat().st_size <= limit, 'archive compressed budget exceeded before copy')
    fd=os.open(source,os.O_RDONLY|getattr(os,'O_NOFOLLOW',0))
    created=False
    try:
        with os.fdopen(fd,'rb') as incoming:
            original=os.fstat(incoming.fileno())
            require(stat.S_ISREG(original.st_mode) and original.st_size <= limit,'archive compressed budget exceeded at open')
            copied=0
            with destination.open('xb') as outgoing:
                created=True
                while True:
                    chunk=incoming.read(min(1024*1024,limit-copied+1))
                    if not chunk:break
                    require(len(chunk) <= limit-copied,'archive compressed budget exceeded while copying')
                    outgoing.write(chunk);copied+=len(chunk)
            final=os.fstat(incoming.fileno())
            require(copied==original.st_size==final.st_size and original.st_mtime_ns==final.st_mtime_ns and original.st_ctime_ns==final.st_ctime_ns,'archive changed while copying')
    except BaseException:
        if created:destination.unlink()
        raise
    return copied

class ExpandedByteLimit:
    """Tar's parser may only request bytes within this full decompression budget."""
    def __init__(self,source,limit):
        self.source,self.limit,self.count=source,limit,0
    def read(self,size):
        require(0 <= size <= self.limit-self.count,'archive total expanded budget exceeded before parser read')
        result=self.source.read(size)
        self.count+=len(result)
        return result

class ImageArchiveInfo(tarfile.TarInfo):
    def _proc_member(self,archive):
        # This known image needs regular files/directories only. Reject PAX/GNU
        # extensions before tarfile reads or allocates their declared payloads.
        require(self.type in (tarfile.REGTYPE,tarfile.AREGTYPE,tarfile.DIRTYPE),'unsupported archive extension/type')
        return super()._proc_member(archive)

def verify_archive(path, image_id, tag):
    """Stream and hash; never extract tar members onto the host."""
    require(path.stat().st_size <= MAX_COMPRESSED, 'archive compressed budget exceeded')
    small, digests, seen, total = {}, {}, set(), 0
    with gzip.open(path,'rb') as decompressed:
        limited=ExpandedByteLimit(decompressed,MAX_EXPANDED)
        with tarfile.open(fileobj=limited,mode='r|',tarinfo=ImageArchiveInfo) as archive:
            for member in archive:
                name = member.name.removeprefix('./')
                require(not PurePosixPath(name).is_absolute() and '..' not in PurePosixPath(name).parts, 'unsafe archive path')
                require(name not in seen, 'duplicate archive member')
                seen.add(name)
                if member.isdir():
                    continue
                require(member.isfile(), 'archive links/devices are forbidden')
                total += member.size
                require(total <= MAX_EXPANDED, 'archive expanded budget exceeded')
                source = archive.extractfile(member)
                h, retained = hashlib.sha256(), bytearray()
                for chunk in iter(lambda: source.read(1024 * 1024), b''):
                    h.update(chunk)
                    if member.size <= 2 * 1024 * 1024:
                        retained.extend(chunk)
                digests[name] = h.hexdigest()
                if member.size <= 2 * 1024 * 1024:
                    small[name] = bytes(retained)
                if name.startswith('blobs/sha256/'):
                    require(re.fullmatch(r'blobs/sha256/[0-9a-f]{64}',name) is not None and h.hexdigest() == name.rsplit('/',1)[1], 'OCI blob checksum mismatch')
        # Charge padding/trailing/concatenated gzip bytes too, not just yielded members.
        while limited.read(min(1024*1024,limited.limit-limited.count) or 1):
            pass
        expanded_bytes=limited.count
    require('manifest.json' in small, 'supported Docker save manifest missing')
    manifest = json.loads(small['manifest.json'])
    require(isinstance(manifest,list) and len(manifest) == 1, 'only one saved image is allowed')
    item = manifest[0]
    require(item.get('RepoTags') == [tag], 'archive would touch an unexpected tag')
    if 'repositories' in small:
        repositories=json.loads(small['repositories'])
        repository,version=tag.split(':',1)
        require(set(repositories)=={repository} and set(repositories[repository])=={version},'unexpected legacy repository tag')
    config = item.get('Config','')
    require(config in digests and 'sha256:'+digests[config] == image_id, 'archive config differs from running immutable image')
    require(all(layer in digests for layer in item.get('Layers',[])), 'archive layer missing')
    rootfs=json.loads(small[config]).get('rootfs',{})
    require(rootfs.get('type') == 'layers', 'unsupported image config')
    require(rootfs.get('diff_ids') == ['sha256:'+digests[layer] for layer in item.get('Layers',[])], 'uncompressed layer identities differ or compressed layer format unsupported')
    if 'index.json' in small:
        require(json.loads(small.get('oci-layout',b'{}')).get('imageLayoutVersion') == '1.0.0','unsupported OCI layout')
        def descend(document, depth=0):
            require(depth <= 4, 'OCI descriptor nesting too deep')
            def annotations_ok(annotations):
                require(set(annotations) <= {'io.containerd.image.name','org.opencontainers.image.ref.name'},'unsupported OCI annotations')
                for key,value in annotations.items():
                    if key == 'io.containerd.image.name':
                        require(value in (tag,'docker.io/library/'+tag), 'unexpected OCI image name')
                    if key == 'org.opencontainers.image.ref.name':
                        require(value in (tag,tag.split(':',1)[1]),'unexpected OCI ref name')
            annotations_ok(document.get('annotations',{}))
            children = document.get('manifests')
            if children is not None:
                require(len(children) == 1, 'only one OCI image descriptor is permitted')
                desc = children[0]
                annotations_ok(desc.get('annotations',{}))
                digest = desc.get('digest','')
                require(re.fullmatch(r'sha256:[0-9a-f]{64}',digest) is not None,'invalid OCI digest')
                child = 'blobs/sha256/'+digest.split(':')[1]
                require(child in small and digests.get(child) == digest.split(':')[1], 'OCI descriptor missing')
                descend(json.loads(small[child]), depth+1)
            else:
                require(document.get('config',{}).get('digest') == image_id,'OCI config differs from running image')
                for layer in document.get('layers',[]):
                    digest = layer.get('digest','')
                    require(re.fullmatch(r'sha256:[0-9a-f]{64}',digest) is not None,'invalid OCI layer digest')
                    require(digests.get('blobs/sha256/'+digest.split(':')[1]) == digest.split(':')[1], 'OCI layer missing')
        descend(json.loads(small['index.json']))
    return {'archive_sha256':sha(path,MAX_COMPRESSED),'expanded_bytes':expanded_bytes,'member_bytes':total,'immutable_image':image_id}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--run-id',required=True)
    parser.add_argument('--attempt',required=True)
    args=parser.parse_args()
    require(re.fullmatch('[0-9]{1,20}',args.run_id) is not None and re.fullmatch('[0-9]{1,3}',args.attempt) is not None,'invalid run identity')
    os.umask(0o077)
    started=time.monotonic()
    project='blagova-preview-restore-drill-'+args.run_id+'-'+args.attempt
    parent=Path('/var/tmp/blagova-preview-restore-drill')
    scratch=parent/('run-'+args.run_id+'-attempt-'+args.attempt)
    tag='blagova-sweets-preview:'+PREVIEW_SHA
    created=False
    cleaning=False
    lock=None
    report={'app_sha':APP_SHA,'preview_sha':PREVIEW_SHA,'status':'failed','drill_run':args.run_id,'stages':[],'live_mutations':False}
    original=None

    def command(argv, *, timeout=90, check=True):
        require(cleaning or time.monotonic()-started < 450,'drill overall deadline exceeded')
        process=subprocess.Popen(argv,text=True,encoding='utf-8',stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
        try:
            stdout,stderr=process.communicate(timeout=min(timeout,15) if cleaning else timeout)
        except BaseException:
            try:
                os.killpg(process.pid,signal.SIGTERM)
                process.wait(timeout=2)
            except (ProcessLookupError,subprocess.TimeoutExpired):
                if process.poll() is None:os.killpg(process.pid,signal.SIGKILL)
                process.wait()
            raise
        completed=subprocess.CompletedProcess(argv,process.returncode,stdout,stderr)
        if check:
            require(completed.returncode == 0,'bounded command failed: '+Path(argv[0]).name)
        return completed

    def docker(*argv):
        return command(['docker',*argv]).stdout.strip()

    def live_identity():
        live=json.loads(docker('inspect',LIVE_NAME))[0]
        return {'id':live['Id'],'image':live['Image'],'tag':live['Config']['Image'],'health':live['State'].get('Health',{}).get('Status'),'read_only':live['HostConfig']['ReadonlyRootfs'],'project':live['Config']['Labels'].get('com.docker.compose.project'),'service':live['Config']['Labels'].get('com.docker.compose.service'),'started_at':live['State']['StartedAt'],'compose_sha256':sha(LIVE/'docker-compose.preview.yml'),'env_sha256':sha(LIVE/'.env'),'marker':(LIVE/'state/current-release').read_text().strip()}

    def inspect_drill():
        ids=docker('ps','-aq','--filter','label=com.docker.compose.project='+project).split()
        require(len(ids) <= 1,'unexpected additional drill containers')
        for cid in ids:
            x=json.loads(docker('inspect',cid))[0]
            require(x['Config']['Labels'].get('com.docker.compose.project') == project and x['Name']=='/'+project+'-storefront-1','drill ownership mismatch')
            require(x['Image'] == original['image'] and x['Config']['Image'] == tag,'drill immutable image mismatch')
            h=x['HostConfig']
            require(h['NetworkMode']=='none' and not h['PortBindings'] and not h['Privileged'],'drill network/privilege boundary violated')
            require(h['ReadonlyRootfs'] and 0<h['Memory']<=134217728 and 0<h['NanoCpus']<=500000000 and 0<h['PidsLimit']<=64,'drill resource boundary violated')
            require('no-new-privileges:true' in h.get('SecurityOpt',[]),'no-new-privileges missing')
            require(all(m['Type']=='tmpfs' and m['Destination'] in ('/var/cache/nginx','/var/run','/tmp') for m in x['Mounts']),'unexpected drill mount')
        return ids

    def config(variant, bad=False):
        return {'name':project,'services':{'storefront':{'image':tag,'pull_policy':'never','restart':'no','network_mode':'none','read_only':True,'security_opt':['no-new-privileges:true'],'tmpfs':['/var/cache/nginx','/var/run','/tmp'],'mem_limit':'128m','cpus':0.5,'pids_limit':64,'stop_grace_period':'5s','labels':{'blagova.recovery-drill':project,'blagova.drill-variant':variant},**({'command':['/bin/sh','-c','exit 17']} if bad else {})}}}

    def invoke(script):
        argv=['bash',str(scratch/script),str(scratch)]
        if script=='deploy-preview.sh':argv += [tag,PREVIEW_SHA,'none',project]
        result=command(argv,timeout=150,check=False)
        (scratch/(script+'.last.log')).write_text(result.stdout+'\n'+result.stderr)
        require(sum(p.stat().st_size for p in scratch.rglob('*') if p.is_file()) <= 512*1024*1024,'scratch budget exceeded')
        return result

    def deadline_signal(signum, frame):
        raise TimeoutError('drill terminated by workflow deadline')
    signal.signal(signal.SIGTERM,deadline_signal)
    signal.signal(signal.SIGINT,deadline_signal)
    try:
        for executable in ['docker','bash','gzip','flock']:
            require(shutil.which(executable) is not None,'required existing executable unavailable')
        require(LIVE.is_dir() and not LIVE.is_symlink(),'live root changed')
        # Shared lock opens the existing live lock read-only; it never creates/truncates it.
        lock=os.fdopen(os.open(LIVE/'.deploy.lock',os.O_RDONLY|os.O_NOFOLLOW),'rb')
        fcntl.flock(lock,fcntl.LOCK_SH|fcntl.LOCK_NB)
        require(not (LIVE/'state/operation-in-progress').exists() and not (LIVE/'state/recovery-required').exists(),'live operation unresolved')
        original=live_identity()
        require(original['marker']==PREVIEW_SHA and original['tag']==tag and original['health']=='healthy' and original['read_only'] and original['project']=='blagova-sweets-preview' and original['service']=='storefront','live baseline changed')
        require(command(['docker','inspect','blagova-sweets-preview'],check=False).returncode != 0,'canonical legacy fallback container exists; stop')
        require(json.loads(docker('image','inspect',tag))[0]['Id']==original['image'],'live image tag drift')
        require(shutil.disk_usage('/var/tmp').free >= 1024**3,'insufficient scratch space')
        if not parent.exists():parent.mkdir()
        st=parent.lstat()
        require(stat.S_ISDIR(st.st_mode) and not parent.is_symlink() and st.st_uid==os.getuid() and st.st_mode & 0o022 == 0,'unsafe scratch parent')
        scratch.mkdir(exist_ok=False);created=True
        (scratch/'OWNED-DRILL').write_text(project+'\n')
        require(len(A1_SCRIPTS)==3,'reviewed A1 bundle not filled')
        for name,item in A1_SCRIPTS.items():
            require(name in ('deploy-preview.sh','rollback-preview.sh','preview-release-lib.sh'),'unexpected bundled script')
            content=base64.b64decode(item['base64'],validate=True)
            require(hashlib.sha256(content).hexdigest()==item['sha256'],'A1 script digest mismatch')
            (scratch/name).write_bytes(content)
        release=scratch/'releases'/PREVIEW_SHA;release.mkdir(parents=True)
        archive=LIVE/'releases'/PREVIEW_SHA/'preview-image.tar.gz'
        require(archive.is_file() and not archive.is_symlink(),'preserved archive missing or symlinked')
        copy_archive_bounded(archive,release/'preview-image.tar.gz')
        require(sha(archive,MAX_COMPRESSED)==sha(release/'preview-image.tar.gz',MAX_COMPRESSED),'archive copy differs')
        shutil.copyfile(LIVE/'docker-compose.preview.yml',scratch/'preserved-compose.yml')
        shutil.copyfile(LIVE/'.env',scratch/'preserved.env')
        # Copies are preserved privately, never reused for running the drill.
        expanded=json.loads(command(['docker','compose','--env-file',str(LIVE/'.env'),'-f',str(LIVE/'docker-compose.preview.yml'),'config','--format','json']).stdout)
        service=expanded.get('services',{}).get('storefront',{})
        require(set(expanded.get('services',{}))=={'storefront'} and service.get('image')==tag and service.get('read_only') is True,'unexpected source Compose service')
        report['archive']=verify_archive(release/'preview-image.tar.gz',original['image'],tag)
        report['stages'].append('archive integrity and existing image identity verified')
        incoming=release/'docker-compose.preview.yml'
        incoming.write_text(json.dumps(config('baseline')))
        # Always enter the managed A1 branch. Its hardcoded legacy branch must
        # never inspect/rename/start a shared container during this drill.
        (scratch/'docker-compose.preview.yml').write_text(json.dumps(config('baseline')))
        (scratch/'.env').write_text('PREVIEW_IMAGE='+tag+'\nPREVIEW_PROXY_NETWORK=none\nPREVIEW_COMPOSE_PROJECT='+project+'\n')
        (scratch/'state').mkdir()
        (scratch/'state/current-release').write_text(PREVIEW_SHA+'\n')
        first=invoke('deploy-preview.sh');require(first.returncode==0,'isolated restored baseline failed')
        ids=inspect_drill();require(len(ids)==1,'restored container missing')
        require(docker('exec',ids[0],'wget','-qO-','http://127.0.0.1/health').strip()=='ok','isolated health failed')
        headers=command(['docker','exec',ids[0],'wget','-S','-O','/dev/null','http://127.0.0.1/health'])
        require('noindex' in headers.stderr.lower(),'isolated noindex header missing')
        good_compose=sha(scratch/'docker-compose.preview.yml');good_env=sha(scratch/'.env')
        report['stages'].append('archive restored into isolated healthy container with noindex')
        incoming.write_text(json.dumps(config('intentional-exit',bad=True)))
        failed=invoke('deploy-preview.sh')
        require(failed.returncode!=0 and failed.stderr.count('attempting one recovery.')==1,'failure did not trigger exactly one recovery')
        require('Previous Preview runtime restored and verified.' in failed.stderr,'runtime recovery not verified')
        ids=inspect_drill();require(len(ids)==1 and json.loads(docker('inspect',ids[0]))[0]['State']['Health']['Status']=='healthy','recovered container unhealthy')
        require(sha(scratch/'docker-compose.preview.yml')==good_compose and sha(scratch/'.env')==good_env and (scratch/'state/current-release').read_text().strip()==PREVIEW_SHA,'recovered config/marker differs')
        require(not (scratch/'state/recovery-required').exists() and not (scratch/'state/operation-in-progress').exists(),'recovery marker unresolved')
        report['stages'].append('intentional exit in disposable container recovered exactly once')
        incoming.write_text(json.dumps(config('second-healthy')))
        require(invoke('deploy-preview.sh').returncode==0,'second isolated config failed')
        require(invoke('rollback-preview.sh').returncode==0,'isolated config rollback failed')
        inspect_drill()
        require(sha(scratch/'docker-compose.preview.yml')==good_compose and sha(scratch/'.env')==good_env,'manual rollback config mismatch')
        report['stages'].append('manual config rollback verified on the same immutable image')
        require(live_identity()==original,'live Preview changed during drill')
        require(json.loads(docker('image','inspect',tag))[0]['Id']==original['image'],'global live tag mapping changed')
        require(sha(archive,MAX_COMPRESSED)==report['archive']['archive_sha256'],'live archive changed')
        report['status']='passed'
    except Exception as exc:
        report['failure']=type(exc).__name__
        # Exception text / command output stays private in owned scratch, never printed.
        if created:(scratch/'failure.private.txt').write_text(str(exc))
    finally:
        cleaning=True
        try:
            if created:
                require(scratch.parent==parent and scratch.name=='run-'+args.run_id+'-attempt-'+args.attempt and not scratch.is_symlink(),'cleanup path mismatch')
                require((scratch/'OWNED-DRILL').read_text()==project+'\n','cleanup marker mismatch')
                ids=inspect_drill() if original else []
                for cid in ids:docker('rm','-f',cid)
                require(not docker('ps','-aq','--filter','label=com.docker.compose.project='+project),'drill cleanup incomplete')
                shutil.rmtree(scratch)
                report['scratch_removed']=True
        except Exception as exc:
            report['status']='failed'
            report['cleanup_failure']=type(exc).__name__
            report['cleanup_required_for_owned_project']=project
        if original:
            try:
                report['live_preview_unchanged']=live_identity()==original
                if not report['live_preview_unchanged']:report['status']='failed'
            except Exception:
                report['status']='failed';report['live_preview_unchanged']='unverified'
        if lock:lock.close()
        print(json.dumps(report,sort_keys=True))
    return 0 if report['status']=='passed' else 1

if __name__=='__main__':
    raise SystemExit(main())
