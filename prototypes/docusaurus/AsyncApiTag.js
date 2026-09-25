// Prototype React component for Docusaurus. Same attribute names and defaults as
// the Python package, and the same delivery of the viewer: the prebuilt
// standalone bundle, pinned by version and Subresource Integrity.
import React, {useEffect, useRef, useState} from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useBaseUrl from '@docusaurus/useBaseUrl';

export const VIEWER = {
  version: '3.2.1',
  js: 'https://unpkg.com/@asyncapi/react-component@3.2.1/browser/standalone/index.js',
  jsIntegrity: 'sha384-wy5bSOazlkSKMGH7XMW6+pK8ho8+rCPr7mTqKdAb/dvfwXAPWCFivgr3C7wJMFAh',
  css: 'https://unpkg.com/@asyncapi/react-component@3.2.1/styles/default.min.css',
  cssIntegrity: 'sha384-oo9RoQcacP++XdMX6CjTucTvASEORHX3chFik0/V2kHcsHiVboGyWZztGeq/0bum',
};

const BOOL = {sidebar: ['show', 'sidebar'], info: ['show', 'info'], servers: ['show', 'servers'],
  operations: ['show', 'operations'], messages: ['show', 'messages'], schemas: ['show', 'schemas'],
  errors: ['show', 'errors'], showmessageexamples: ['show', 'messageExamples'],
  messageexamples: ['expand', 'messageExamples'], usechanneladdressasidentifier: ['sidebar', 'useChannelAddressAsIdentifier']};
const ENUM = {showservers: ['sidebar', 'showServers'], showoperations: ['sidebar', 'showOperations']};
const STR = {publishlabel: 'publishLabel', subscribelabel: 'subscribeLabel', sendlabel: 'sendLabel',
  receivelabel: 'receiveLabel', requestlabel: 'requestLabel', replylabel: 'replyLabel', schemaid: 'schemaID'};

export function buildConfig(options) {
  const config = {show: {sidebar: false, info: true, servers: true, operations: true, messages: true, schemas: true, errors: true},
    expand: {messageExamples: true}};
  for (const [key, raw] of Object.entries(options || {})) {
    const k = key.toLowerCase();
    if (k === 'id') continue;
    if (BOOL[k]) { const [s, p] = BOOL[k]; const v = String(raw).trim().toLowerCase();
      config[s] = config[s] || {}; config[s][p] = raw === '' || ['true', '1', 'yes', 'on'].includes(v); }
    else if (ENUM[k]) { const [s, p] = ENUM[k]; config[s] = config[s] || {}; config[s][p] = raw; }
    else if (STR[k]) config[STR[k]] = raw;
    else if (k === 'parseroptions') { try { config.parserOptions = JSON.parse(raw); } catch {} }
    else console.warn(`asyncapi-tag: unknown option '${key}' ignored`);
  }
  return config;
}

let viewerPromise;
function loadViewer() {
  if (window.AsyncApiStandalone) return Promise.resolve(window.AsyncApiStandalone);
  if (!viewerPromise) viewerPromise = new Promise((resolve, reject) => {
    const link = Object.assign(document.createElement('link'), {rel: 'stylesheet', href: VIEWER.css, integrity: VIEWER.cssIntegrity, crossOrigin: 'anonymous'});
    document.head.appendChild(link);
    const script = Object.assign(document.createElement('script'), {src: VIEWER.js, integrity: VIEWER.jsIntegrity, crossOrigin: 'anonymous'});
    script.onload = () => resolve(window.AsyncApiStandalone);
    script.onerror = () => reject(new Error('the viewer script did not load'));
    document.head.appendChild(script);
  });
  return viewerPromise;
}

function Viewer({src, options}) {
  const url = useBaseUrl(src);
  const opts = typeof options === 'string' ? JSON.parse(options || '{}') : (options || {});
  const ref = useRef(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let live = true;
    Promise.all([loadViewer(), fetch(url).then((r) => r.ok ? r.text() : Promise.reject(new Error(`could not load ${url} (HTTP ${r.status})`)))])
      .then(([viewer, text]) => { if (live && ref.current) return viewer.render({schema: text, config: buildConfig(opts)}, ref.current); })
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [url]);
  if (error) return <div className="asyncapi-tag"><p className="asyncapi-tag-error">AsyncAPI viewer: {error}</p></div>;
  return <div className="asyncapi-tag" id={opts.id} ref={ref}><p>Loading AsyncAPI document…</p></div>;
}

export default function AsyncApiTag(props) {
  return <BrowserOnly fallback={<div className="asyncapi-tag"><p>Loading AsyncAPI document…</p></div>}>{() => <Viewer {...props} />}</BrowserOnly>;
}
