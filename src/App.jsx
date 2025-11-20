import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Check, Trash2, Lock, Unlock } from 'lucide-react'
import './App.css'

function App() {
  const [priceList, setPriceList] = useState('')
  const [productList, setProductList] = useState('')
  const [matchResult, setMatchResult] = useState('')
  const [stats, setStats] = useState({ matched: 0, unmatched: 0, total: 0 })
  const [copied, setCopied] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [lockedResult, setLockedResult] = useState('')

  // --- Helper Functions ---

  // Clear all inputs and scroll to top
  // 使用 useCallback 確保函數穩定
  const clearAll = useCallback(() => {
    console.log("Executing clearAll...") // Debug log
    setPriceList('')
    setProductList('')
    setMatchResult('')
    setLockedResult('')
    setStats({ matched: 0, unmatched: 0, total: 0 })
    setIsLocked(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    
    // 強制讓所有輸入框失去焦點
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }, [])

  // Apply deductions based on remarks
  const applyDeductions = (basePrice, remarks) => {
    let finalPrice = basePrice
    finalPrice -= 15 // Basic deduction
    
    const deductions = {
      '小花': -100, '花機': -150, '大花': -350, '舊機': -350,
      '低保': -100, '過保': -200, '黑機': -200, '配置鎖': -300
    }
    
    for (const [keyword, amount] of Object.entries(deductions)) {
      if (remarks.includes(keyword)) {
        finalPrice += amount
      }
    }
    return finalPrice
  }

  // Extract capacity
  const extractCapacity = (description) => {
    const capacityMatch = description.match(/\b(\d+(?:GB|TB))\b/i)
    return capacityMatch ? capacityMatch[1].toUpperCase() : ''
  }

  // Extract model name
  const extractModelName = (text, removeColor = false) => {
    let model = text.replace(/\b\d+(?:GB|TB)\b/gi, '').trim()
    if (removeColor) {
      const colors = ['BLACK', 'WHITE', 'BLUE', 'ORANGE', 'SILVER', 'GOLD', 'NATURAL', 'DESERT', 
                      'PINK', 'ULTRAMARINE', 'GRAY', 'GREY', 'GREEN', 'RED', 'PURPLE', 
                      'YELLOW', 'LAVENDER', 'SAGE', 'MIDNIGHT', 'STARLIGHT', 'TITANIUM',
                      'SPACE', 'ROSE', 'CORAL', 'TEAL', 'INDIGO', 'CRIMSON']
      for (const color of colors) {
        const regex = new RegExp(`\\b${color}\\b\\s*$`, 'i')
        model = model.replace(regex, '').trim()
      }
    }
    return model.toUpperCase().replace(/\s+/g, ' ')
  }

  // Check if category requires color matching
  const needsColorMatch = (category, priceModel = '') => {
    const cat = category.toUpperCase()
    if (cat.includes('UNLOCKED')) return true
    if (cat.includes('LOCKED')) return cat.includes('N/A') || cat.includes('ACT')
    if (cat === 'DEFAULT') return false
    return true
  }

  // Check capacity match needed
  const needsCapacityMatch = (description) => {
    const upper = description.toUpperCase()
    return upper.includes('IPHONE') || upper.includes('IPAD') || upper.includes('MACBOOK')
  }

  // Model matching logic
  const modelsMatch = (productModel, priceModel) => {
    const p = productModel.toUpperCase().trim()
    const pr = priceModel.toUpperCase().trim()
    if (p === pr) return true
    
    const pWords = p.split(/\s+/).filter(w => w.length > 0)
    const prWords = pr.split(/\s+/).filter(w => w.length > 0)
    if (pWords.length !== prWords.length) return false
    
    for (let i = 0; i < pWords.length; i++) {
      if (pWords[i] !== prWords[i]) return false
    }
    return true
  }

  // Parse Price List
  const parsePriceList = (text) => {
    const lines = text.trim().split('\n')
    const prices = []
    let currentCategory = 'DEFAULT'

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const upperLine = trimmed.toUpperCase()
      const isHeader = (
        (upperLine.includes('CAP') || upperLine.includes('CAPACITY') || upperLine.includes('容量')) &&
        (upperLine.includes('QTY') || upperLine.includes('QUANTITY') || upperLine.includes('數量')) &&
        (upperLine.includes('HKD') || upperLine.includes('USD') || upperLine.includes('CNY') || 
         upperLine.includes('RMB') || upperLine.includes('PRICE') || upperLine.includes('人民幣'))
      )
      
      if (isHeader) {
        const parts = trimmed.split('\t')
        if (parts.length > 1) {
          const firstCol = parts[0].trim()
          if (firstCol === firstCol.toUpperCase() && 
              !firstCol.match(/CAP|QTY|HKD|USD|CNY|RMB/)) {
            currentCategory = firstCol
          }
        }
        continue
      }

      const chineseCategories = ['IPAD 原封沒激活', 'IPAD 激活全套有鎖']
      if ((!trimmed.includes('\t') && trimmed === trimmed.toUpperCase()) || chineseCategories.includes(trimmed)) {
        currentCategory = trimmed
        continue
      }

      const parts = trimmed.split(/\s+/)
      if (parts.length >= 3) {
        const model = parts[0].trim()
        const secondCol = parts[1].trim()
        const isPartNumber = /^[A-Z0-9]{6,10}$/i.test(secondCol) && !secondCol.match(/\d+(GB|TB)$/i)
        
        let capacity = ''
        let qty = 0
        let price = 0
        
        if (isPartNumber) {
          qty = parseInt(parts[2]) || 0
          price = parseFloat(parts[3]) || 0
        } else {
          capacity = secondCol
          qty = parseInt(parts[2]) || 0
          price = parseFloat(parts[3]) || 0
        }

        prices.push({
          category: currentCategory,
          model: model,
          capacity: capacity,
          qty: qty,
          price: price
        })
      }
    }
    return prices
  }

  // Parse Product List
  const parseProductList = (text) => {
    const lines = text.trim().split('\n')
    const products = []
    let currentCategory = 'DEFAULT'

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const upperLine = trimmed.toUpperCase()
      if (upperLine.includes('CAP') && upperLine.includes('QTY') && upperLine.includes('HKD')) continue

      const chineseCategories = ['IPAD 原封沒激活', 'IPAD 激活全套有鎖']
      if ((!trimmed.includes('\t') && trimmed === trimmed.toUpperCase()) || chineseCategories.includes(trimmed)) {
        currentCategory = trimmed
        continue
      }

      const parts = trimmed.split('\t')
      if (parts.length >= 2) {
        const lineNum = parts[0].trim()
        let remarks = ''
        let description = ''
        
        if (parts.length === 2) {
          description = parts[1].trim()
        } else if (parts.length >= 3) {
          remarks = parts[1].trim()
          description = parts[2].trim()
        }
        
        if (lineNum && description) {
          products.push({ lineNum, remarks, description, category: currentCategory })
        }
      }
    }
    return products
  }

  // Match logic
  const matchProducts = () => {
    const prices = parsePriceList(priceList)
    const products = parseProductList(productList)
    const results = []
    let matchedCount = 0
    let unmatchedCount = 0
    let lastCategory = null

    for (const product of products) {
      const productCapacity = extractCapacity(product.description)
      const requiresCapacity = needsCapacityMatch(product.description)
      let matchedPrice = null

      for (const price of prices) {
        if (price.category !== product.category) continue
        const requiresColor = needsColorMatch(product.category, price.model)
        const productModel = extractModelName(product.description, !requiresColor)
        const priceModel = extractModelName(price.model, !requiresColor)
        
        if (!modelsMatch(productModel, priceModel)) continue
        
        if (requiresCapacity) {
          const priceCapacity = price.capacity || extractCapacity(price.model)
          if (priceCapacity && productCapacity && priceCapacity !== productCapacity) continue
        }

        matchedPrice = price
        break
      }

      if (matchedPrice !== null) {
        if (lastCategory !== null && lastCategory !== product.category) {
          results.push(''); results.push('')
        }
        results.push(`${product.lineNum}\t${matchedPrice.price}`)
        matchedCount++
        lastCategory = product.category
      } else {
        unmatchedCount++
      }
    }
    setMatchResult(results.join('\n'))
    setStats({ matched: matchedCount, unmatched: unmatchedCount, total: products.length })
  }

  // Locked Matching logic
  const processLockedMatching = () => {
    const prices = parsePriceList(priceList)
    const products = parseProductList(productList)
    const results = []
    let matchedCount = 0
    let unmatchedCount = 0
    let lastCategory = null

    for (const product of products) {
      const productCapacity = extractCapacity(product.description)
      const requiresCapacity = needsCapacityMatch(product.description)
      let matchedPrice = null

      for (const price of prices) {
        if (price.category !== product.category) continue
        const requiresColor = needsColorMatch(product.category, price.model)
        const productModel = extractModelName(product.description, !requiresColor)
        const priceModel = extractModelName(price.model, !requiresColor)
        
        if (!modelsMatch(productModel, priceModel)) continue
        
        if (requiresCapacity) {
          const priceCapacity = price.capacity || extractCapacity(price.model)
          if (priceCapacity && productCapacity && priceCapacity !== productCapacity) continue
        }

        matchedPrice = price
        break
      }

      if (matchedPrice !== null) {
        if (lastCategory !== null && lastCategory !== product.category) {
          results.push(''); results.push('')
        }
        const remarks = product.remarks || ''
        const deductedPrice = applyDeductions(matchedPrice.price, remarks)
        results.push(`${product.lineNum}\t${deductedPrice}`)
        matchedCount++
        lastCategory = product.category
      } else {
        unmatchedCount++
      }
    }
    setLockedResult(results.join('\n'))
  }

  // --- Effects ---

  useEffect(() => {
    if (priceList.trim() && productList.trim()) {
      const timer = setTimeout(() => {
        matchProducts()
        if (isLocked) processLockedMatching()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [priceList, productList, isLocked])

  useEffect(() => {
    if (matchResult) {
      const autoCopy = async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(matchResult)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }
        } catch (err) { console.error('Auto-copy failed:', err) }
      }
      autoCopy()
    }
  }, [matchResult])

  // --- [CRITICAL FIX] ESC Key Handler with Capture Phase ---
  useEffect(() => {
    const handleKeyDown = (event) => {
      // 1. 如果正在使用輸入法（如中文選字），不要觸發清除
      if (event.nativeEvent.isComposing || event.key === 'Process') {
        return
      }

      if (event.key === 'Escape') {
        // Debugging log: 打開 F12 可以看到這個
        console.log("ESC pressed - Triggering clearAll")
        
        // 2. 阻止事件繼續傳播，確保不會被 Textarea 吃掉
        event.stopPropagation()
        // event.preventDefault() // 視情況，如果這行導致無法操作可移除

        clearAll()
      }
    }
    
    // 3. { capture: true } 是重點！這會讓 Window 比 Textarea 更早收到事件
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [clearAll])

  // --- UI Actions ---
  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(matchResult)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = matchResult
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        try {
          document.execCommand('copy')
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch (err) { alert('複製失敗') }
        document.body.removeChild(textArea)
      }
    } catch (err) { alert('複製失敗') }
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-3">
            產品價格匹配系統
          </h1>
          <p className="text-lg text-gray-600">
            自動匹配產品列表與價格，快速生成報價結果
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="border border-gray-300">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-medium text-gray-700">第一步：輸入價格列表</CardTitle>
                  <CardDescription className="text-sm text-gray-500">貼上您的 PRICE LIST</CardDescription>
                </div>
                <Button 
                  onClick={() => {
                    setIsLocked(!isLocked)
                    if (!isLocked && priceList.trim() && productList.trim()) {
                      setTimeout(() => processLockedMatching(), 100)
                    }
                  }}
                  variant={isLocked ? "default" : "outline"}
                  size="sm"
                  className={isLocked ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-gray-300 hover:bg-blue-50 hover:text-blue-700'}
                >
                  {isLocked ? <><Lock className="w-4 h-4 mr-2" />有鎖</> : <><Unlock className="w-4 h-4 mr-2" />有鎖</>}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="UNLOCKED N/A&#10;IPHONE 15 BLACK&#9;128GB&#9;3&#9;3700"
                className="h-[300px] overflow-y-auto font-mono text-sm bg-white border-gray-300 resize-none"
                value={priceList}
                onChange={(e) => setPriceList(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card className="border border-gray-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-gray-700">第二步：輸入產品列表</CardTitle>
              <CardDescription className="text-sm text-gray-500">貼上您的 LIST</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="22&#9;IPHONE 16E 128GB BLACK"
                className="h-[300px] overflow-y-auto font-mono text-sm bg-white border-gray-300 resize-none"
                value={productList}
                onChange={(e) => setProductList(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        {matchResult && (
          <Card className="border border-gray-300">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-medium text-gray-700">匹配結果</CardTitle>
                  <CardDescription className="text-sm text-gray-500">系統已完成自動匹配</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={copyToClipboard} variant="outline" size="sm" className={copied ? 'bg-green-50 border-green-600 text-green-700' : 'border-gray-300'}>
                    {copied ? <><Check className="w-4 h-4 mr-2" />已複製</> : '複製結果'}
                  </Button>
                  <Button onClick={clearAll} variant="outline" size="sm" className="border-gray-300 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="w-4 h-4 mr-2" />清除
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea value={matchResult} readOnly className="h-[300px] overflow-y-auto font-mono text-sm bg-white border-gray-300 resize-none" />
            </CardContent>
          </Card>
        )}

        {isLocked && lockedResult && (
          <Card className="border border-blue-300 bg-blue-50/30 mt-6">
            <CardHeader className="pb-3">
              <div className="flex justify-between">
                <CardTitle className="text-lg font-medium text-blue-700 flex items-center"><Lock className="w-5 h-5 mr-2" />有鎖模式扣減結果</CardTitle>
                <Button onClick={() => navigator.clipboard.writeText(lockedResult)} variant="outline" size="sm" className="border-blue-300 hover:bg-blue-100">複製扣減結果</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea value={lockedResult} readOnly className="h-[300px] overflow-y-auto font-mono text-sm bg-white border-blue-300 resize-none" />
            </CardContent>
          </Card>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>© 2025 產品價格匹配系統 - 快速、準確、高效</p>
        </div>
      </div>
    </div>
  )
}

export default App
