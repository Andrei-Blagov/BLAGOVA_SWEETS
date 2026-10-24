import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {parse} from '@vue/compiler-dom';
const consumer=createRequire(import.meta.resolve('@rollup/plugin-terser'));
const serialize=consumer('serialize-javascript');
test('actual bundler serializer escapes a spoofed function ending at a script boundary',()=>{
 function f(){}f.toString=()=> 'function f(){ return 1 }//</script';
 function g(){}g.toString=()=> 'function g(x){ return x } > <b id=synthetic>';
 const output=serialize({a:{f},g,text:'</script>'},{space:2});
 assert.doesNotMatch(output,/<\/script/i);assert.ok(output.includes('}//\\u003C\\u002Fscript\n'));
 // Function source is otherwise serialized verbatim. The adversarial <b> must
 // remain script text, rather than becoming a live HTML element after a close.
 const html=parse('<script>'+output+'</script>');assert.equal(html.children.length,1);assert.equal(html.children[0].tag,'script');
});
