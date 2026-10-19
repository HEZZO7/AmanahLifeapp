"""Host-only pinned-input operations; invoked only in an approved future CI run."""
from pathlib import Path
import json,platform,subprocess,sys
from repro import read_locks,require,verify_sha256,verify_image,download_tarballs

root=Path(__file__).resolve().parent
command=sys.argv[1]
_,_,lock=read_locks(root)
if command=='image':
    print(lock['images'][sys.argv[2]]['reference'])
elif command=='cli':
    verify_sha256(Path(sys.argv[2]).read_bytes(),lock['cli']['sha256'])
    print('PASS: CLI archive matches the committed publisher release checksum')
elif command=='tarballs':
    download_tarballs(root,Path(sys.argv[2]))
elif command=='images':
    require(platform.system()=='Linux' and platform.machine() in ('x86_64','AMD64'), 'Standard linux/amd64 runner required')
    result={}
    for name,pin in lock['images'].items():
        ref=pin['reference']
        subprocess.run(['docker','pull','--platform=linux/amd64',ref],check=True,stdout=subprocess.DEVNULL)
        info=json.loads(subprocess.check_output(['docker','image','inspect',ref]))[0]
        verify_image(info,pin)
        if 'cli_alias' in pin:
            subprocess.run(['docker','tag',ref,pin['cli_alias']],check=True)
        result[name]={'image_id':info['Id'],'reference':ref}
    Path(sys.argv[2]).write_text(json.dumps(result,sort_keys=True)+'\n')
    print('PASS: seven pinned images pulled and checked for linux/amd64')
else: raise ValueError('Unknown pinned-input operation')
