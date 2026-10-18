/** Each new request, cancel, or reset invalidates every older asynchronous result. */
export function createRequestEpoch() {
  let generation = 0;
  let controller;
  return {
    begin() {
      controller?.abort(); controller = new AbortController(); generation++;
      return { id: generation, signal: controller.signal };
    },
    cancel() { generation++; controller?.abort(); controller = undefined; },
    current(id) { return generation === id; },
  };
}
export function wholeContextBlob(raw) {
  const value = JSON.parse(raw);
  if (value.format !== 'tacitus-uploaded-knowledge-context/1' || !value.context) throw new Error('unsupported_context');
  return new Blob([raw], { type: 'application/json' });
}
