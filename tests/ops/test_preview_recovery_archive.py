"""Synthetic archive validation only; no Docker, SSH, app data or filesystem deletion."""
import ast
import hashlib
import gzip
import io
import json
import re
import os
import stat
import tarfile
import tempfile
import unittest
import types
from pathlib import Path, PurePosixPath

namespace={'hashlib':hashlib,'gzip':gzip,'json':json,'re':re,'tarfile':tarfile,'os':os,'stat':stat,'PurePosixPath':PurePosixPath,'MAX_EXPANDED':400*1024*1024,'MAX_COMPRESSED':128*1024*1024}
script=Path(__file__).with_name('preview-recovery-drill.py')
if not script.exists():script=Path(__file__).resolve().parents[2]/'scripts/preview-recovery-drill.py'
tree=ast.parse(script.read_text(encoding='utf-8'))
selected=[n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name in ('require','sha','verify_archive','copy_archive_bounded','ExpandedByteLimit','ImageArchiveInfo')]
exec(compile(ast.Module(body=selected,type_ignores=[]),'<reviewed archive validators>','exec'),namespace)
verify=namespace['verify_archive']

class ArchiveBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.path=Path(self.temp.name)/'image.tar.gz'
        self.tag='blagova-sweets-preview:'+'a'*40
        self.layer=b'synthetic uncompressed layer'
        self.config=json.dumps({'rootfs':{'type':'layers','diff_ids':['sha256:'+hashlib.sha256(self.layer).hexdigest()]}}).encode()
        self.image='sha256:'+hashlib.sha256(self.config).hexdigest()
    def tearDown(self):self.temp.cleanup()
    def write(self, *,tag=None,config=None,layer=None,extra=None):
        rows=[('config.json',self.config if config is None else config),('layer.tar',self.layer if layer is None else layer),('manifest.json',json.dumps([{'Config':'config.json','RepoTags':[tag or self.tag],'Layers':['layer.tar']}]).encode())]
        if extra:rows+=extra
        with tarfile.open(self.path,'w:gz') as t:
            for name,data in rows:
                m=tarfile.TarInfo(name);m.size=len(data);t.addfile(m,io.BytesIO(data))
    def test_valid_single_image(self):
        self.write();self.assertEqual(verify(self.path,self.image,self.tag)['immutable_image'],self.image)
    def test_other_global_tag_rejected(self):
        self.write(tag='unrelated:latest')
        with self.assertRaisesRegex(RuntimeError,'unexpected tag'):verify(self.path,self.image,self.tag)
    def test_wrong_image_config_rejected(self):
        self.write(config=b'{}')
        with self.assertRaisesRegex(RuntimeError,'config differs'):verify(self.path,self.image,self.tag)
    def test_modified_layer_rejected(self):
        self.write(layer=b'changed layer')
        with self.assertRaisesRegex(RuntimeError,'layer identities'):verify(self.path,self.image,self.tag)
    def test_parent_traversal_rejected(self):
        self.write(extra=[('../outside',b'x')])
        with self.assertRaisesRegex(RuntimeError,'unsafe archive path'):verify(self.path,self.image,self.tag)
    def test_duplicate_member_rejected(self):
        self.write(extra=[('config.json',b'{}')])
        with self.assertRaisesRegex(RuntimeError,'duplicate'):verify(self.path,self.image,self.tag)
    def test_oci_multiple_descriptor_rejected(self):
        self.write(extra=[('oci-layout',b'{"imageLayoutVersion":"1.0.0"}'),('index.json',b'{"manifests":[{},{}]}')])
        with self.assertRaisesRegex(RuntimeError,'only one OCI'):verify(self.path,self.image,self.tag)
    def test_oci_root_foreign_name_rejected(self):
        self.write(extra=[('oci-layout',b'{"imageLayoutVersion":"1.0.0"}'),('index.json',b'{"annotations":{"io.containerd.image.name":"unrelated:latest"},"manifests":[{}]}')])
        with self.assertRaisesRegex(RuntimeError,'unexpected OCI image name'):verify(self.path,self.image,self.tag)
    def test_legacy_repository_foreign_tag_rejected(self):
        self.write(extra=[('repositories',b'{"unrelated":{"latest":"anything"}}')])
        with self.assertRaisesRegex(RuntimeError,'unexpected legacy repository tag'):verify(self.path,self.image,self.tag)
    def test_oversize_rejected_before_destination_creation(self):
        class OversizeSource:
            def stat(self):return types.SimpleNamespace(st_size=33)
        destination=Path(self.temp.name)/'copy.tar.gz'
        with self.assertRaisesRegex(RuntimeError,'before copy'):
            namespace['copy_archive_bounded'](OversizeSource(),destination,limit=32)
        self.assertFalse(destination.exists())
    def test_bounded_copy_preserves_exact_bytes(self):
        source=Path(self.temp.name)/'source.bin';source.write_bytes(b'exact synthetic archive')
        destination=Path(self.temp.name)/'copy.bin'
        self.assertEqual(namespace['copy_archive_bounded'](source,destination,limit=32),23)
        self.assertEqual(source.read_bytes(),destination.read_bytes())
    def test_concurrent_growth_cannot_exceed_copy_cap(self):
        source=Path(self.temp.name)/'source.bin';source.write_bytes(b'a'*16)
        destination=Path(self.temp.name)/'copy.bin'
        original_os=namespace['os']
        class GrowingFile:
            def __init__(self,fd):self.file=os.fdopen(fd,'rb');self.grown=False
            def __enter__(self):return self
            def __exit__(self,*args):self.file.close()
            def fileno(self):return self.file.fileno()
            def read(self,size):
                if not self.grown:
                    with source.open('ab') as stream:stream.write(b'b'*64)
                    self.grown=True
                return self.file.read(size)
        namespace['os']=types.SimpleNamespace(open=os.open,O_RDONLY=os.O_RDONLY,O_NOFOLLOW=getattr(os,'O_NOFOLLOW',0),fstat=os.fstat,fdopen=lambda fd,mode:GrowingFile(fd))
        try:
            with self.assertRaisesRegex(RuntimeError,'while copying'):
                namespace['copy_archive_bounded'](source,destination,limit=32)
            self.assertFalse(destination.exists())
        finally:namespace['os']=original_os
    def test_pax_decompression_repro_exceeds_complete_budget(self):
        with tarfile.open(self.path,'w:gz',format=tarfile.PAX_FORMAT,pax_headers={'comment':'x'*8192}) as archive:
            member=tarfile.TarInfo('tiny');member.size=1;archive.addfile(member,io.BytesIO(b'x'))
        original=namespace['MAX_EXPANDED'];namespace['MAX_EXPANDED']=1024
        try:
            with self.assertRaisesRegex(RuntimeError,'total expanded budget'):
                verify(self.path,self.image,self.tag)
        finally:namespace['MAX_EXPANDED']=original
    def test_pax_extension_rejected_before_payload_parser(self):
        with tarfile.open(self.path,'w:gz',format=tarfile.PAX_FORMAT,pax_headers={'comment':'x'*8192}) as archive:
            member=tarfile.TarInfo('tiny');member.size=1;archive.addfile(member,io.BytesIO(b'x'))
        with self.assertRaisesRegex(RuntimeError,'unsupported archive extension/type'):
            verify(self.path,self.image,self.tag)
    def test_trailing_gzip_bytes_are_charged(self):
        self.write()
        with self.path.open('ab') as stream:stream.write(gzip.compress(b'x'*65536))
        original=namespace['MAX_EXPANDED'];namespace['MAX_EXPANDED']=32768
        try:
            with self.assertRaisesRegex(RuntimeError,'total expanded budget'):
                verify(self.path,self.image,self.tag)
        finally:namespace['MAX_EXPANDED']=original

if __name__=='__main__':unittest.main()
