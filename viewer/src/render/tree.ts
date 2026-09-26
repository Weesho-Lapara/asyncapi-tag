/**
 * The payload tree (spec 4.8): stacked rows, guide lines per level, expand/collapse with real
 * buttons, a toolbar with counts, oneOf/anyOf as a segmented control, constraints under the
 * description, and leaves for circular references. RawSchema renders as a labelled code block.
 *
 * Display rules that differ from the model: the "[]" item node of an array is not a row. A
 * primitive item folds into the parent's type ("array of string"); an object item's children
 * are shown as the array's children, and their path already reads "items[]".
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import { slug } from '../model/context.js';
import type { Schema, SchemaNode } from '../model/types.js';
import { renderInline } from './markdown.js';

export const treeStyles = css`
  .tree {
    border: 1px solid var(--_line);
    border-radius: var(--_radius);
    background: var(--_surface);
    overflow: hidden;
  }
  .tree__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    padding: 8px 12px 8px 16px;
    background: var(--_head);
    border-bottom: 1px solid var(--_line);
    font-size: 12.5px;
    color: var(--_muted);
  }
  .tree__bar .spacer {
    flex: 1;
  }
  .tree__bar button {
    min-height: 32px;
    padding: 0 10px;
    border: 0;
    background: none;
    color: var(--_primary-text);
    font: 500 12.5px/1 var(--_font-body);
    cursor: pointer;
    border-radius: var(--_radius-sm);
  }
  .tree__bar button:hover {
    background: var(--_tint);
  }
  .tree__bar button:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: -2px;
  }
  .tree__body {
    padding: 0;
  }
  .tree__empty {
    margin: 0;
    padding: 6px 4px;
    color: var(--_muted);
    font-size: 13px;
  }
  ul.branch {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  ul.branch ul.branch {
    margin-left: 28px;
    padding-left: 22px;
    border-left: 1px solid var(--_line-2);
  }
  li.row + li.row,
  li.row > div > ul.branch > li.row:first-child {
    border-top: 1px solid var(--_line);
  }
  ul.branch[data-depth='4'] ul.branch,
  ul.branch[data-depth='5'] ul.branch,
  ul.branch[data-depth='6'] ul.branch,
  ul.branch[data-depth='7'] ul.branch,
  ul.branch[data-depth='8'] ul.branch,
  ul.branch[data-depth='9'] ul.branch {
    padding-left: 12px;
  }
  .row {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr);
    column-gap: 10px;
    padding: 11px 16px 11px 12px;
  }
  .row > div {
    min-width: 0;
  }
  .row__toggle {
    width: 26px;
    height: 26px;
    padding: 0;
    border: 1px solid var(--_line);
    border-radius: 6px;
    background: var(--_surface);
    color: var(--_ink-2);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .row__toggle:hover {
    border-color: var(--_line-2);
  }
  .row__toggle:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: 1px;
  }
  .row__toggle svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 120ms;
  }
  .row__toggle[aria-expanded='true'] svg {
    transform: rotate(90deg);
  }
  .row__spacer {
    width: 26px;
  }
  .row__line1 {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    min-height: 26px;
  }
  .row__name {
    font: 600 13px/1.5 var(--_font-mono);
    color: var(--_ink);
    overflow-wrap: anywhere;
  }
  .row__type {
    font: 400 12px/1.5 var(--_font-mono);
    color: var(--_muted);
  }
  .row__hidden {
    height: 20px;
    padding: 0 7px;
    font-size: 11px;
  }
  .row__req {
    margin-left: auto;
    font: 600 11.5px/1.5 var(--_font-body);
    color: var(--_secondary-text);
  }
  .row__req--optional {
    font-weight: 400;
    color: var(--_muted);
  }
  .row__path {
    font: 400 11.5px/1.5 var(--_font-mono);
    color: var(--_muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .row__desc {
    font-size: 13px;
    line-height: 1.5;
    color: var(--_ink-2);
  }
  .row__facts {
    font: 400 11.5px/1.6 var(--_font-mono);
    color: var(--_muted);
    overflow-wrap: anywhere;
  }
  .row__circular {
    font-size: 13px;
    color: var(--_ink-2);
  }
  .variants {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px;
    margin: 4px 0 6px;
    padding: 3px;
    border: 1px solid var(--_line);
    border-radius: var(--_radius-sm);
    background: var(--_head);
  }
  .variants button {
    min-height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: calc(var(--_radius-sm) - 2px);
    background: none;
    color: var(--_ink-2);
    font: 500 12.5px/1 var(--_font-body);
    cursor: pointer;
  }
  .variants button[aria-pressed='true'] {
    background: var(--_surface);
    color: var(--_ink);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
  }
  .variants button:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: -2px;
  }
  /* At the top of a tree the switcher hangs off the toolbar as a full-width strip. */
  .tree__body > .variants {
    display: flex;
    margin: 0;
    padding: 6px 12px;
    border: 0;
    border-bottom: 1px solid var(--_line);
    border-radius: 0;
    background: var(--_head);
  }
  .tree__body > .row__desc {
    padding: 10px 16px 4px;
  }
  .variants__label {
    align-self: center;
    padding: 0 6px 0 8px;
    font: 500 11px/1 var(--_font-body);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--_muted);
  }
  .raw {
    border: 1px solid var(--_line);
    border-radius: var(--_radius);
    background: var(--_surface);
    overflow: hidden;
  }
  .raw__bar {
    padding: 8px 16px;
    background: var(--_head);
    border-bottom: 1px solid var(--_line);
    font: 400 12.5px/1.4 var(--_font-mono);
    color: var(--_muted);
  }
  .raw pre {
    margin: 0;
    padding: 12px 16px;
    overflow: auto;
    font: 12.5px/1.5 var(--_font-mono);
    color: var(--_ink);
  }
  @container viewer (max-width: 699px) {
    ul.branch ul.branch {
      margin-left: 14px;
      padding-left: 12px;
    }
    .row {
      padding: 10px 10px 10px 6px;
    }
    ul.branch[data-depth='4'] ul.branch,
    ul.branch[data-depth='5'] ul.branch,
    ul.branch[data-depth='6'] ul.branch,
    ul.branch[data-depth='7'] ul.branch,
    ul.branch[data-depth='8'] ul.branch,
    ul.branch[data-depth='9'] ul.branch {
      padding-left: 8px;
    }
    .tree__body {
      padding: 6px 8px 8px;
    }
  }
`;

/** Expansion and variant selection for one tree, keyed by node path. */
export class TreeState {
  readonly #expanded = new Set<string>();
  readonly #collapsed = new Set<string>();
  readonly #variant = new Map<string, number>();
  #all: boolean | undefined;

  constructor(readonly onChange: () => void) {}

  isExpanded(key: string, depth: number): boolean {
    if (this.#collapsed.has(key)) return false;
    if (this.#expanded.has(key)) return true;
    if (this.#all !== undefined) return this.#all;
    return depth <= 2; // levels 1 to 3 open by default
  }

  /** True once "Expand all" was used and nothing has been collapsed since. */
  get allExpanded(): boolean {
    return this.#all === true && this.#collapsed.size === 0;
  }

  toggle(key: string, depth: number): void {
    const next = !this.isExpanded(key, depth);
    this.#expanded.delete(key);
    this.#collapsed.delete(key);
    (next ? this.#expanded : this.#collapsed).add(key);
    this.onChange();
  }

  setAll(expanded: boolean): void {
    this.#all = expanded;
    this.#expanded.clear();
    this.#collapsed.clear();
    this.onChange();
  }

  variant(key: string): number {
    return this.#variant.get(key) ?? 0;
  }

  selectVariant(key: string, index: number): void {
    this.#variant.set(key, index);
    this.onChange();
  }
}

export interface TreeOptions {
  /** Toolbar text at the left; the field count when absent. */
  label?: string;
  /** Anchor prefix of the viewer, for links to the Schemas section. */
  prefix: string;
  /** Unique within the viewer, e.g. the message anchor plus "payload". */
  key: string;
  state: TreeState;
}

/** The rows shown for a node: object properties, or the array item's children (folded). */
function displayChildren(node: SchemaNode): SchemaNode[] {
  const item = arrayItem(node);
  if (item) return displayChildren(item);
  return node.children;
}

function arrayItem(node: SchemaNode): SchemaNode | undefined {
  const only = node.children.length === 1 ? node.children[0] : undefined;
  return only && only.name === '[]' ? only : undefined;
}

/** The composition to show for a node, following folded array items. */
function displayComposition(node: SchemaNode): SchemaNode['composition'] {
  const item = arrayItem(node);
  return item ? displayComposition(item) : node.composition;
}

export function typeLabel(node: SchemaNode): string {
  const item = arrayItem(node);
  if (item && node.types.length <= 1) {
    const inner = typeLabel(item);
    return inner ? `array<${inner}>` : 'array';
  }
  let label = node.types.join(' | ');
  if (node.format) label = `${label || 'string'} · ${node.format}`;
  if (node.enum && node.enum.length > 0) label = `${label || 'string'} · enum`;
  if (!label && node.composition) label = node.composition.kind;
  if (!label && node.circularRef) label = 'object';
  return label;
}

function countNodes(node: SchemaNode): { fields: number; levels: number } {
  let fields = 0;
  let levels = 0;
  const walk = (n: SchemaNode, depth: number) => {
    for (const c of displayChildren(n)) {
      fields++;
      levels = Math.max(levels, depth);
      walk(c, depth + 1);
    }
    const comp = displayComposition(n);
    if (comp) for (const v of comp.variants) walk(v.node, depth);
  };
  walk(node, 1);
  return { fields, levels };
}

function countDescendants(node: SchemaNode): number {
  let n = 0;
  for (const c of displayChildren(node)) n += 1 + countDescendants(c);
  return n;
}

function factsLine(node: SchemaNode): string | undefined {
  const parts: string[] = [];
  if (node.enum) parts.push(`enum: ${node.enum.map(short).join(' · ')}`);
  if (node.const !== undefined) parts.push(`const: ${short(node.const)}`);
  if (node.default !== undefined) parts.push(`default: ${short(node.default)}`);
  for (const c of node.constraints) parts.push(`${c.key}: ${short(c.value)}`);
  if (node.deprecated) parts.push('deprecated');
  if (node.readOnly) parts.push('read-only');
  if (node.writeOnly) parts.push('write-only');
  return parts.length > 0 ? parts.join('  ·  ') : undefined;
}

function short(value: unknown): string {
  if (typeof value === 'string') return value;
  const text = JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

const chevron = html`<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2.5 7.5 6 4 9.5" /></svg>`;

export function renderSchema(schema: Schema | undefined, options: TreeOptions): TemplateResult | typeof nothing {
  if (!schema) return nothing;
  if (schema.kind === 'raw') {
    return html`<div class="raw">
      <div class="raw__bar">${schema.schemaFormat}</div>
      <pre tabindex="0" aria-label="Schema source, scrollable"><code>${schema.source}</code></pre>
    </div>`;
  }
  const { fields } = countNodes(schema);
  const rows = displayChildren(schema);
  const composition = displayComposition(schema);
  const allOpen = options.state.allExpanded;
  return html`<div class="tree">
    <div class="tree__bar">
      <span class=${options.label ? 'mono' : ''}>${options.label ?? `${fields} field${fields === 1 ? '' : 's'}`}</span>
      <span class="spacer"></span>
      <button type="button" @click=${() => options.state.setAll(!allOpen)}>${allOpen ? 'Collapse all' : 'Expand all'}</button>
    </div>
    <div class="tree__body">
      ${composition ? renderVariants(schema, composition, options, options.key, 1) : nothing}
      ${rows.length > 0
        ? renderBranch(rows, options, options.key, 1)
        : composition
          ? nothing
          : html`<p class="tree__empty">${typeLabel(schema) ? `A single value of type ${typeLabel(schema)}.` : 'No fields are described.'}</p>`}
    </div>
  </div>`;
}

function renderBranch(nodes: SchemaNode[], options: TreeOptions, parentKey: string, depth: number): TemplateResult {
  return html`<ul class="branch" data-depth=${Math.min(depth, 9)}>
    ${nodes.map((node) => renderRow(node, options, `${parentKey}/${node.name}`, depth))}
  </ul>`;
}

function renderRow(node: SchemaNode, options: TreeOptions, key: string, depth: number): TemplateResult {
  const children = displayChildren(node);
  const composition = displayComposition(node);
  const expandable = children.length > 0 || composition !== undefined;
  const expanded = expandable && options.state.isExpanded(key, depth);
  const hidden = expandable && !expanded ? countDescendants(node) : 0;
  const facts = factsLine(node);
  const circularHref = node.circularRef ? `#${options.prefix}--schemas--${slug(node.circularRef)}` : undefined;
  return html`<li class="row ${depth === 1 ? 'row--top' : ''}">
    ${expandable
      ? html`<button
          class="row__toggle"
          type="button"
          aria-expanded=${expanded ? 'true' : 'false'}
          aria-label="${expanded ? 'Collapse' : 'Expand'} ${node.name}"
          @click=${() => options.state.toggle(key, depth)}
        >
          ${chevron}
        </button>`
      : html`<span class="row__spacer"></span>`}
    <div>
      <div class="row__line1">
        <span class="row__name">${node.name}</span>
        <span class="row__type">${typeLabel(node)}</span>
        ${hidden > 0 ? html`<span class="pill pill--outline row__hidden">${hidden} hidden</span>` : nothing}
        ${node.required ? html`<span class="row__req">required</span>` : html`<span class="row__req row__req--optional">optional</span>`}
      </div>
      ${depth >= 4 && node.path.length > 0 ? html`<div class="row__path">${node.path.join(' › ')}</div>` : nothing}
      ${node.circularRef
        ? html`<div class="row__circular">Circular reference to <a href=${circularHref}>${node.circularRef}</a></div>`
        : nothing}
      ${node.description ? html`<div class="row__desc">${renderInline(node.description)}</div>` : nothing}
      ${facts ? html`<div class="row__facts">${facts}</div>` : nothing}
      ${expanded && composition ? renderVariants(node, composition, options, key, depth + 1) : nothing}
      ${expanded && children.length > 0 ? renderBranch(children, options, key, depth + 1) : nothing}
    </div>
  </li>`;
}

function renderVariants(
  owner: SchemaNode,
  composition: NonNullable<SchemaNode['composition']>,
  options: TreeOptions,
  key: string,
  depth: number,
): TemplateResult {
  const selected = Math.min(options.state.variant(key), composition.variants.length - 1);
  const variant = composition.variants[selected]!;
  const rows = displayChildren(variant.node);
  return html`
    <div class="variants" role="group" aria-label="${composition.kind} variants of ${owner.name || 'the payload'}">
      <span class="variants__label">${composition.kind}</span>
      ${composition.variants.map(
        (v, i) => html`<button type="button" aria-pressed=${i === selected ? 'true' : 'false'} @click=${() => options.state.selectVariant(key, i)}>${v.title}</button>`,
      )}
    </div>
    ${variant.node.description ? html`<div class="row__desc">${renderInline(variant.node.description)}</div>` : nothing}
    ${rows.length > 0
      ? renderBranch(rows, options, `${key}/${composition.kind}${selected}`, depth)
      : html`<p class="tree__empty">${typeLabel(variant.node) ? `A single value of type ${typeLabel(variant.node)}.` : 'No fields are described.'}</p>`}
  `;
}
