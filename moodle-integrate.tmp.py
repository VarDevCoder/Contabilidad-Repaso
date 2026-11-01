from pathlib import Path
import json
p=Path('index.html')
s=p.read_text(encoding='utf-8')
data=json.loads(Path('moodle-materials-data.tmp.json').read_text(encoding='utf-8'))
block=Path('moodle-materials.tmp.js').read_text(encoding='utf-8').replace('/* COURSE_DATA */',json.dumps(data,ensure_ascii=False,indent=2))
assert 'const COURSE_MATERIALS=' not in s
assert "['examen','Simulacro','clock']];" in s
s=s.replace("['examen','Simulacro','clock']];", "['examen','Simulacro','clock'],['materiales','Materiales','book']];",1)
assert 'desarrollo:development})[state.screen]' in s
s=s.replace('desarrollo:development})[state.screen]','desarrollo:development,materiales})[state.screen]',1)
marker='\nrender();\n</script>'
assert s.count(marker)==1
s=s.replace(marker,'\n'+block+'\nrender();\n</script>',1)
p.write_text(s,encoding='utf-8')
