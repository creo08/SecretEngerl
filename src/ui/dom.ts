/** Small DOM helpers. User data only ever goes in as text nodes, never as HTML. */

type Child = Node | string | null | undefined | false;

/** Creates an element with attributes and children; strings become text nodes. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children) if (child) el.append(child);
  return el;
}

/** The element with this id; throws if the page lacks it. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

let nextId = 0;
/** A unique id for label and description links. */
export function uid(prefix: string): string {
  return `${prefix}-${++nextId}`;
}

/** Shows one view, hides the others, and moves focus to its heading for screen readers. */
export function showView(id: string): void {
  const current = document.querySelector<HTMLElement>('[data-view]:not([hidden])');
  for (const view of document.querySelectorAll<HTMLElement>('[data-view]')) view.hidden = view.id !== id;
  // The first view of a page load keeps the browser's own focus.
  if (current?.id === id) return;
  const heading = document.querySelector<HTMLElement>(`#${id} h1, #${id} h2`);
  if (heading) {
    heading.tabIndex = -1;
    heading.focus();
  }
  window.scrollTo(0, 0);
}

/** Replaces the children of `el`. */
export function fill(el: Element, ...children: Child[]): void {
  el.replaceChildren(...children.filter((c): c is Node | string => Boolean(c)));
}

/** Saves text as a file on the device, created locally. */
export function downloadFile(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: fileName });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A section that opens on click, with a title and a short line saying what it holds. */
export function disclosure(title: string, hint: string, content: HTMLElement, cls = 'more'): HTMLDetailsElement {
  return h('details', { class: cls }, h('summary', {}, h('span', { class: 'summary-title' }, title), h('span', { class: 'summary-hint' }, hint)), content);
}

/** Asks for confirmation in a modal dialog; resolves true on confirm. */
export function confirmDialog(text: string, confirmLabel: string, cancelLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    const confirm = h('button', { type: 'button', class: 'btn btn--ink' }, confirmLabel);
    const cancel = h('button', { type: 'button', class: 'btn btn--card' }, cancelLabel);
    const id = uid('dialog');
    const dialog = h('dialog', { class: 'dialog stock', 'aria-labelledby': id }, h('p', { id }, text), h('div', { class: 'actions' }, confirm, cancel));
    const close = (value: boolean) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    confirm.addEventListener('click', () => close(true));
    cancel.addEventListener('click', () => close(false));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close(false);
    });
    document.body.append(dialog);
    dialog.showModal();
    cancel.focus();
  });
}

/** A labelled form field with an optional help line linked by aria-describedby. */
export function field(label: string, control: HTMLElement, help?: string): HTMLElement {
  const id = control.id || uid('f');
  control.id = id;
  const helpId = help ? `${id}-help` : undefined;
  if (helpId) control.setAttribute('aria-describedby', helpId);
  return h('div', { class: 'field' }, h('label', { for: id }, label), control, help ? h('p', { id: helpId, class: 'help' }, help) : null);
}

/** An empty box for validation messages, announced when filled. */
export function errorBox(): HTMLElement {
  return h('div', { class: 'errors', role: 'alert' });
}

/** Shows validation messages as a list, or clears the box. */
export function showErrors(box: HTMLElement, messages: string[]): void {
  fill(box, ...(messages.length ? [h('ul', {}, ...messages.map((m) => h('li', {}, m)))] : []));
}

/** A checkbox with its label and a help line. */
export function checkbox(label: string, help: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const input = h('input', { type: 'checkbox', id: uid('c') });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  const helpId = `${input.id}-help`;
  input.setAttribute('aria-describedby', helpId);
  return h('div', { class: 'check' }, input, h('label', { for: input.id }, label), h('p', { id: helpId, class: 'help' }, help));
}
