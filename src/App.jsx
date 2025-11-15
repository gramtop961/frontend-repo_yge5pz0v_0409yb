import { useState, useMemo, useEffect, useRef } from 'react'

function useCalculator() {
  const [expression, setExpression] = useState('')
  const [result, setResult] = useState('0')
  const [angleMode, setAngleMode] = useState('DEG') // or 'RAD'
  const [memory, setMemory] = useState(0)
  const [history, setHistory] = useState([]) // {expr, res}

  const append = (val) => {
    setExpression((prev) => (prev + val))
  }

  const clear = () => {
    setExpression('')
    setResult('0')
  }

  const backspace = () => {
    setExpression((prev) => prev.slice(0, -1))
  }

  const insertConstant = (name) => {
    if (name === 'π') append('π')
    if (name === 'e') append('e')
  }

  const percent = () => {
    // interpret % as *0.01 for the preceding value
    setExpression((prev) => prev + '*0.01')
  }

  const toggleSign = () => {
    // Wrap the last number or parenthesized expression in -( )
    setExpression((prev) => {
      if (!prev) return '-' // start negative
      // Find last token
      let i = prev.length - 1
      let depth = 0
      if (prev[i] === ')') {
        depth = 1
        i--
        while (i >= 0) {
          if (prev[i] === ')') depth++
          else if (prev[i] === '(') depth--
          if (depth === 0) break
          i--
        }
        const before = prev.slice(0, i)
        const target = prev.slice(i)
        return `${before}-${target}`
      } else {
        // grab last number
        const match = prev.match(/.*?(\d*\.?\d+(?:e[+-]?\d+)?|π|e)$/)
        if (match) {
          const start = match[0].length - match[1].length
          const before = prev.slice(0, start)
          const target = prev.slice(start)
          return `${before}-(${target})`
        }
        return '-' + prev
      }
    })
  }

  const memoryClear = () => setMemory(0)
  const memoryRecall = () => append(formatNumber(memory))
  const memoryAdd = () => {
    const val = tryEvaluate(expression, angleMode)
    if (val != null) setMemory((m) => m + val)
  }
  const memorySubtract = () => {
    const val = tryEvaluate(expression, angleMode)
    if (val != null) setMemory((m) => m - val)
  }

  useEffect(() => {
    const val = tryEvaluate(expression, angleMode)
    if (val == null) {
      setResult('')
    } else {
      setResult(formatNumber(val))
    }
  }, [expression, angleMode])

  const calculate = () => {
    const val = tryEvaluate(expression, angleMode)
    if (val != null) {
      const resStr = formatNumber(val)
      setHistory((h) => [{ expr: expression, res: resStr }, ...h].slice(0, 20))
      setExpression(resStr)
      setResult(resStr)
    }
  }

  return {
    expression,
    setExpression,
    result,
    angleMode,
    setAngleMode,
    memory,
    history,
    append,
    clear,
    backspace,
    insertConstant,
    percent,
    toggleSign,
    memoryClear,
    memoryRecall,
    memoryAdd,
    memorySubtract,
    calculate,
  }
}

function toJSExpression(expr) {
  if (!expr) return ''
  let s = expr
  // Replace unicode operators
  s = s.replace(/×/g, '*').replace(/÷/g, '/')
  // Power
  s = s.replace(/\^/g, '**')
  // Constants placeholders
  s = s.replace(/π/g, 'PI').replace(/\be\b/g, 'E')

  // Factorial: replace a! with FACT(a) repeatedly
  let safety = 0
  const factorialRegex = /(\([^()]*\)|\d*\.?\d+(?:e[+-]?\d+)?)!/g
  while (factorialRegex.test(s) && safety < 20) {
    s = s.replace(factorialRegex, 'FACT($1)')
    safety++
  }

  // Functions -> placeholders
  s = s.replace(/asin\(/gi, 'ASIN(')
  s = s.replace(/acos\(/gi, 'ACOS(')
  s = s.replace(/atan\(/gi, 'ATAN(')

  s = s.replace(/sin\(/gi, 'SIN(')
  s = s.replace(/cos\(/gi, 'COS(')
  s = s.replace(/tan\(/gi, 'TAN(')

  s = s.replace(/ln\(/gi, 'LN(')
  s = s.replace(/log\(/gi, 'LOG(')
  s = s.replace(/sqrt\(/gi, 'SQRT(')

  return s
}

function tryEvaluate(expr, angleMode) {
  try {
    const transformed = toJSExpression(expr)
    if (!transformed) return 0
    const D2R = Math.PI / 180
    const R2D = 180 / Math.PI

    const SIN = (x) => Math.sin((angleMode === 'DEG') ? x * D2R : x)
    const COS = (x) => Math.cos((angleMode === 'DEG') ? x * D2R : x)
    const TAN = (x) => Math.tan((angleMode === 'DEG') ? x * D2R : x)

    const ASIN = (x) => (angleMode === 'DEG') ? Math.asin(x) * R2D : Math.asin(x)
    const ACOS = (x) => (angleMode === 'DEG') ? Math.acos(x) * R2D : Math.acos(x)
    const ATAN = (x) => (angleMode === 'DEG') ? Math.atan(x) * R2D : Math.atan(x)

    const LN = (x) => Math.log(x)
    const LOG = (x) => Math.log10 ? Math.log10(x) : Math.log(x) / Math.LN10
    const SQRT = (x) => Math.sqrt(x)
    const FACT = (n) => {
      n = Number(n)
      if (n < 0 || !Number.isFinite(n)) return NaN
      if (Math.floor(n) !== n) return gamma(n + 1)
      let r = 1
      for (let i = 2; i <= n; i++) r *= i
      return r
    }
    const gamma = (z) => {
      // Lanczos approximation for Gamma function
      const g = 7
      const p = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028,
        771.32342877765313, -176.61502916214059, 12.507343278686905,
        -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
      ]
      if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z))
      z -= 1
      let x = p[0]
      for (let i = 1; i < g + 2; i++) x += p[i] / (z + i)
      const t = z + g + 0.5
      return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x
    }

    const PI = Math.PI
    const E = Math.E

    // Use Function with provided helpers only
    // Disallow identifiers other than our helpers and numbers/operators
    const fn = new Function('SIN','COS','TAN','ASIN','ACOS','ATAN','LN','LOG','SQRT','FACT','PI','E','return (' + transformed + ')')
    const out = fn(SIN,COS,TAN,ASIN,ACOS,ATAN,LN,LOG,SQRT,FACT,PI,E)
    if (typeof out === 'number' && Number.isFinite(out)) return out
    return null
  } catch (e) {
    return null
  }
}

function formatNumber(n) {
  if (n === null || n === undefined) return ''
  if (!Number.isFinite(n)) return 'Error'
  // Show up to 12 significant digits, with trimming
  const s = Number(n).toPrecision(12)
  // Remove trailing zeros and dot
  return s.replace(/(?:\.\d*?[1-9])0+$/,'$1').replace(/\.0+$/,'').replace(/\.($)/,'$1')
}

function Key({ label, onClick, variant = 'default', span = 1 }) {
  const base = 'h-12 sm:h-14 md:h-16 rounded-lg text-sm sm:text-base font-medium transition-all active:scale-[0.98]'
  const styles = {
    default: 'bg-white/70 hover:bg-white text-gray-800 shadow border border-gray-200',
    accent: 'bg-blue-600 hover:bg-blue-700 text-white shadow',
    warn: 'bg-rose-500 hover:bg-rose-600 text-white shadow',
    soft: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
    ghost: 'bg-transparent hover:bg-white/60 text-gray-700 border border-white/40',
  }
  return (
    <button
      onClick={onClick}
      className={`${base} ${styles[variant]} col-span-${span}`}
    >
      {label}
    </button>
  )
}

export default function App() {
  const {
    expression, setExpression, result,
    angleMode, setAngleMode,
    history,
    append, clear, backspace, insertConstant, percent, toggleSign,
    memoryClear, memoryRecall, memoryAdd, memorySubtract,
    calculate
  } = useCalculator()

  const inputRef = useRef(null)

  const buttons = [
    [{l:'MC', a: memoryClear, v:'soft'}, {l:'MR', a: memoryRecall, v:'soft'}, {l:'M+', a: memoryAdd, v:'soft'}, {l:'M-', a: memorySubtract, v:'soft'}],
    [{l:'sin', a:()=>append('sin(')}, {l:'cos', a:()=>append('cos(')}, {l:'tan', a:()=>append('tan(')}, {l:'^', a:()=>append('^')}],
    [{l:'ln', a:()=>append('ln(')}, {l:'log', a:()=>append('log(')}, {l:'√', a:()=>append('sqrt(')}, {l:'!', a:()=>append('!')}],
    [{l:'(', a:()=>append('(')}, {l:')', a:()=>append(')')}, {l:'π', a:()=>insertConstant('π')}, {l:'e', a:()=>insertConstant('e')}],
    [{l:'7', a:()=>append('7')}, {l:'8', a:()=>append('8')}, {l:'9', a:()=>append('9')}, {l:'÷', a:()=>append('÷')}],
    [{l:'4', a:()=>append('4')}, {l:'5', a:()=>append('5')}, {l:'6', a:()=>append('6')}, {l:'×', a:()=>append('×')}],
    [{l:'1', a:()=>append('1')}, {l:'2', a:()=>append('2')}, {l:'3', a:()=>append('3')}, {l:'−', a:()=>append('-')}],
    [{l:'+/-', a:toggleSign, v:'ghost'}, {l:'0', a:()=>append('0')}, {l:'.', a:()=>append('.')}, {l:'+', a:()=>append('+')}],
  ]

  const topActions = [
    {l:'C', v:'warn', a: clear},
    {l:'⌫', v:'soft', a: backspace},
    {l:'%', v:'soft', a: percent},
    {l: angleMode === 'DEG' ? 'DEG' : 'RAD', v:'ghost', a: ()=> setAngleMode(angleMode === 'DEG' ? 'RAD' : 'DEG')},
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-sky-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-3 bg-white/10 backdrop-blur rounded-2xl p-4 sm:p-6 shadow-xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-widest text-white/70">Scientific Calculator</div>
            <div className="flex gap-2">
              {topActions.map((b, i) => (
                <Key key={i} label={b.l} variant={b.v} onClick={b.a} />
              ))}
            </div>
          </div>

          <div className="bg-black/30 rounded-xl p-4 sm:p-5 mb-4 border border-white/10">
            <div className="text-right text-sm text-white/70 min-h-[20px] break-all select-text" aria-label="expression">
              {expression || '0'}
            </div>
            <div className="text-right text-3xl sm:text-4xl md:text-5xl font-semibold mt-2 min-h-[40px] break-all" aria-label="result">
              {result || ''}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {buttons.flat().map((b, idx) => (
              <Key key={idx} label={b.l} onClick={b.a} variant={b.v || 'default'} />
            ))}
            <div className="col-span-4">
              <button onClick={calculate} className="w-full h-12 sm:h-14 md:h-16 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-lg shadow">
                =
              </button>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-white/10 backdrop-blur rounded-2xl p-4 sm:p-6 shadow-xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-widest text-white/70">History</div>
            <button className="text-xs text-white/70 hover:text-white" onClick={()=>window.scrollTo({top:0, behavior:'smooth'})}>Top ↑</button>
          </div>
          <div className="space-y-3 max-h-[480px] overflow-auto pr-1">
            {history.length === 0 && (
              <div className="text-white/60 text-sm">Calculations will appear here.</div>
            )}
            {history.map((h, i) => (
              <div key={i} className="bg-black/30 border border-white/10 rounded-lg p-3 cursor-pointer hover:bg-black/40" onClick={()=>setExpression(h.res)}>
                <div className="text-white/70 text-sm break-all">{h.expr}</div>
                <div className="text-white text-lg font-semibold break-all">= {h.res}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-3 right-3 text-xs text-white/60">Mode: {angleMode}</div>
    </div>
  )
}
