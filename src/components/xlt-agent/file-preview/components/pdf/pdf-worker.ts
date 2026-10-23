import * as pdfjs from 'pdfjs-dist'

// 同包产物路径，webpack/turbopack 会识别并单独打包
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString()

export {pdfjs}
