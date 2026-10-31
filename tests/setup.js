/* Chuẩn bị môi trường Node (jsdom) để chạy mã của website. */
const path = require('path');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = undefined;
global.DOMParser = dom.window.DOMParser;
global.document = dom.window.document;
global.Node = dom.window.Node;
const load = (f) => require(path.join(__dirname, '..', 'js', f));
['util.js', 'htmlkit.js', 'matrix.js', 'parse-exam.js', 'check.js', 'shuffle.js', 'doc.js', 'readers.js', 'sample.js'].forEach(load);
module.exports = { dom };
