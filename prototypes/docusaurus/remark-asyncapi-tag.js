// Prototype remark plugin: turns ```asyncapi fences and <asyncapi-tag> elements
// into <AsyncApiTag src options /> and injects the component import.
const {visit} = require('unist-util-visit');

const COMPONENT = 'AsyncApiTag';
const IMPORT_FROM = '@site/src/components/AsyncApiTag';

function parseFenceBody(body, meta) {
  const options = {};
  const src = (meta || '').trim().replace(/^["']|["']$/g, '');
  if (src) options.src = src;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i === -1) { options[line.toLowerCase()] = ''; continue; } // bare key = true
    const key = line.slice(0, i).trim().toLowerCase();
    let value = line.slice(i + 1).trim();
    if (value.length >= 2 && value[0] === value.at(-1) && `"'`.includes(value[0])) value = value.slice(1, -1);
    options[key] = value;
  }
  return options;
}

function jsxNode(options) {
  const {src, ...rest} = options;
  return {
    type: 'mdxJsxFlowElement',
    name: COMPONENT,
    attributes: [
      {type: 'mdxJsxAttribute', name: 'src', value: src || ''},
      {type: 'mdxJsxAttribute', name: 'options', value: JSON.stringify(rest)},
    ],
    children: [],
  };
}

const importNode = () => ({
  type: 'mdxjsEsm',
  value: `import ${COMPONENT} from '${IMPORT_FROM}';`,
  data: {estree: {type: 'Program', sourceType: 'module', body: [{
    type: 'ImportDeclaration',
    specifiers: [{type: 'ImportDefaultSpecifier', local: {type: 'Identifier', name: COMPONENT}}],
    source: {type: 'Literal', value: IMPORT_FROM, raw: `'${IMPORT_FROM}'`},
  }]}},
});

module.exports = function remarkAsyncApiTag() {
  return (tree) => {
    let used = false;
    visit(tree, 'code', (node, index, parent) => {
      if ((node.lang || '').toLowerCase() !== 'asyncapi') return;
      parent.children[index] = jsxNode(parseFenceBody(node.value || '', node.meta));
      used = true;
    });
    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node) => {
      if (node.name !== 'asyncapi-tag') return;
      const options = {};
      for (const a of node.attributes || []) if (a.type === 'mdxJsxAttribute') options[a.name.toLowerCase()] = a.value == null ? '' : String(a.value);
      Object.assign(node, jsxNode(options));
      used = true;
    });
    if (used) tree.children.unshift(importNode());
  };
};
