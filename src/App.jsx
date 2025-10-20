import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Check, Trash2, Lock, Unlock } from 'lucide-react';
import './App.css';

function App() {
  const [priceList, setPriceList] = useState('');
  const [productList, setProductList] = useState('');
  const [matchResult, setMatchResult] = useState('');
  const [stats, setStats] = useState({ matched: 0, unmatched: 0, total: 0 });
  const [copied, setCopied] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedResult, setLockedResult] = useState('');

  // Apply deductions based on remarks
  const applyDeductions = (basePrice, remarks) => {
    let finalPrice = basePrice;
    
    // Basic deduction: 15 yuan accessory fee
    finalPrice -= 15;
    
    // Keyword-based deductions
    const deductions = {
      '小花': -100,
      '花機': -150,
      '大花': -350,
      '舊機': -350,
      '低保': -100,
      '過保': -200,
      '黑機': -200,
      '配置鎖': -300
    };
    
    // Check for keywords in remarks
    for (const [keyword, amount] of Object.entries(deductions)) {
      if (remarks.includes(keyword)) {
        finalPrice += amount;  // amount is already negative
      }
    }
    
    return finalPrice;
  };

  // Process locked mode matching with deductions
  const processLockedMatching = () => {
    const prices = parsePriceList(priceList);
    const products = parseProductList(productList);
    
    const results = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    let lastCategory = null;

    for (const product of products) {
      const productCapacity = extractCapacity(product.description);
      const requiresCapacity = needsCapacityMatch(product.description);
      
      let matchedPrice = null;

      for (const price of prices) {
        if (price.category !== product.category) continue;

        // Check if this specific price item needs color matching
        const requiresColor = needsColorMatch(product.category, price.model);
        
        const productModel = extractModelName(product.description, !requiresColor);
        const priceModel = extractModelName(price.model, !requiresColor);
        
        if (!modelsMatch(productModel, priceModel)) {
          continue;
        }
        
        if (requiresCapacity) {
          // If price.capacity is empty, extract from price.model
          const priceCapacity = price.capacity || extractCapacity(price.model);
          if (priceCapacity && productCapacity && priceCapacity !== productCapacity) {
            continue;
          }
        }

        matchedPrice = price;
        break;
      }

      if (matchedPrice !== null) {
        // Add double line break between different categories
        if (lastCategory !== null && lastCategory !== product.category) {
          results.push('');  // Empty line
          results.push('');  // Second empty line
        }
        
        // Use remarks from parsed product data (B欄備註)
        const remarks = product.remarks || '';
        
        // Apply deductions
        const deductedPrice = applyDeductions(matchedPrice.price, remarks);
        
        results.push(`${product.lineNum}\t${deductedPrice}`);
        matchedCount++;
        lastCategory = product.category;
      } else {
        unmatchedCount++;
      }
    }

    setLockedResult(results.join('\n'));
  };

  // Clear all inputs and scroll to top
  const handleClearAll = () => {
    setPriceList("");
    setProductList("");
    setMatchResult("");
    setLockedResult("");
    setStats({ matched: 0, unmatched: 0, total: 0 });
    setIsLocked(false);
    setCopied(false); // 重置複製狀態

    // 清除 localStorage（如果有使用）
    localStorage.clear(); // 清除所有 localStorage

    // Scroll to top     window.scrollTo({ top: 0, behavior: 'smooth' });
    console.log("All data cleared successfully");
  };

  // Listen for ESC key to clear all data
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' || event.keyCode === 27) {
        event.preventDefault();
        event.stopPropagation();
        handleClearAll();
        console.log('ESC key pressed, clearing all data.');
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleClearAll]);

  // Auto-copy result to clipboard when matchResult changes
  useEffect(() => {
    if (matchResult && matchResult.trim()) {
      const autoCopy = async () => {
        try {
          // 添加短暫延遲，避免過於頻繁
          await new Promise(resolve => setTimeout(resolve, 300));
          
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(matchResult);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            console.log('Auto-copy successful');  // 👈 調試用
          }
        } catch (err) {
          console.error('Auto-copy failed:', err);
          // 靜默失敗，不打擾用戶
        }
      };
      autoCopy();
    }
  }, [matchResult]);

  // Parse price list into structured data
  const parsePriceList = (text) => {
    const lines = text.trim().split('\n');
    const prices = [];
    let currentCategory = 'DEFAULT';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip header rows (CAP QTY HKD, etc.) - check this FIRST
      const upperLine = trimmed.toUpperCase();
      const isHeader = (upperLine.includes('CAP') || upperLine.includes('CAPACITY')) && 
          (upperLine.includes('QTY') || upperLine.includes('QUANTITY')) && 
          (upperLine.includes('HKD') || upperLine.includes('USD') || upperLine.includes('CNY') || 
           upperLine.includes('RMB') || upperLine.includes('PRICE'));
      
      if (isHeader) {
        // Extract category from first column if present
        const parts = trimmed.split('\t');
        if (parts.length > 1) {
          const firstCol = parts[0].trim();
          // Check if first column looks like a category (all uppercase, not a header keyword)
          if (firstCol === firstCol.toUpperCase() && 
              !firstCol.includes('CAP') && 
              !firstCol.includes('QTY') && 
              !firstCol.includes('HKD') && 
              !firstCol.includes('USD') && 
              !firstCol.includes('CNY') && 
              !firstCol.includes('RMB')) {
            currentCategory = firstCol;
          }
        }
        continue;
      }

      // Check if it's a category line (no tabs, all uppercase, not a header)
      if (!trimmed.includes('\t') && trimmed === trimmed.toUpperCase()) {
        currentCategory = trimmed;
        continue;
      }

      // Parse price line
      const parts = trimmed.split('\t');
      if (parts.length >= 3) {
        const model = parts[0].trim();
        const secondCol = parts[1].trim();
        const isPartNumber = /^[A-Z0-9]{6,10}$/i.test(secondCol) && !secondCol.match(/\d+(GB|TB)$/i);
        
        let capacity = '';
        let qty = 0;
        let price = 0;
        
        if (isPartNumber) {
          qty = parseInt(parts[2]) || 0;
          price = parseFloat(parts[3]) || 0;
        } else {
          capacity = secondCol;
          qty = parseInt(parts[2]) || 0;
          price = parseFloat(parts[3]) || 0;
        }

        prices.push({
          category: currentCategory,
          model: model,
          capacity: capacity,
          qty: qty,
          price: price
        });
      }
    }

    return prices;
  };

  // Parse product list with line numbers
  const parseProductList = (text) => {
    const lines = text.trim().split('\n');
    const products = [];
    let currentCategory = 'DEFAULT';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip header rows
      const upperLine = trimmed.toUpperCase();
      if (upperLine.includes('CAP') && upperLine.includes('QTY') && upperLine.includes('HKD')) {
        continue;
      }

      // Check if it's a category line
      if (!trimmed.includes('\t') && trimmed === trimmed.toUpperCase()) {
        currentCategory = trimmed;
        continue;
      }

      // Parse product line with line number
      const parts = trimmed.split('\t');
      
      if (parts.length >= 2) {
        const lineNum = parts[0].trim();
        let remarks = '';
        let description = '';
        
        if (parts.length === 2) {
          description = parts[1].trim();
        } else if (parts.length >= 3) {
          remarks = parts[1].trim(); // B欄備註
          description = parts[2].trim();
        }
        
        if (lineNum && description) {
          products.push({
            lineNum,
            remarks,
            description,
            category: currentCategory
          });
        }
      }
    }

    return products;
  };

  // Extract capacity from product description
  const extractCapacity = (description) => {
    const capacityMatch = description.match(/\b(\d+(?:GB|TB))\b/i);
    return capacityMatch ? capacityMatch[1].toUpperCase() : '';
  };

  // Extract model name without capacity (and optionally without color)
  const extractModelName = (text, removeColor = false) => {
    let model = text.replace(/\b\d+(?:GB|TB)\b/gi, '').trim();
    
    if (removeColor) {
      const colors = ['BLACK', 'WHITE', 'BLUE', 'ORANGE', 'SILVER', 'GOLD', 'NATURAL', 'DESERT', 
                      'PINK', 'ULTRAMARINE', 'GRAY', 'GREY', 'GREEN', 'RED', 'PURPLE', 
                      'YELLOW', 'LAVENDER', 'SAGE', 'MIDNIGHT', 'STARLIGHT', 'TITANIUM',
                      'SPACE', 'ROSE', 'CORAL', 'TEAL', 'INDIGO', 'CRIMSON'];
      
      for (const color of colors) {
        const regex = new RegExp(`\\b${color}\\b\\s*$`, 'i');
        model = model.replace(regex, '').trim();
      }
    }
    
    return model.toUpperCase().replace(/\s+/g, ' ');
  };

  // Check if category requires color matching
  const needsColorMatch = (category, priceModel = '') => {
    const cat = category.toUpperCase();
    const model = priceModel.toUpperCase();
    
    // UNLOCKED categories always need color matching
    if (cat.includes('UNLOCKED')) return true;
    
    // LOCKED categories: only match color if category contains N/A or ACT
    if (cat.includes('LOCKED')) {
      if (cat.includes('N/A') || cat.includes('ACT')) return true;
      // For other LOCKED categories, only match color if the price model explicitly contains a color
      const colors = ['BLACK', 'WHITE', 'BLUE', 'ORANGE', 'SILVER', 'GOLD', 'NATURAL', 'DESERT', 
                      'PINK', 'ULTRAMARINE', 'GRAY', 'GREY', 'GREEN', 'RED', 'PURPLE', 
                      'YELLOW', 'LAVENDER', 'SAGE', 'MIDNIGHT', 'STARLIGHT', 'TITANIUM',
                      'SPACE', 'ROSE', 'CORAL', 'TEAL', 'INDIGO', 'CRIMSON'];
      return colors.some(color => model.includes(color));
    }
    return false;
  };

  // Check if models match (case-insensitive, ignoring capacity and potentially color)
  const modelsMatch = (productModel, priceModel) => {
    // Exact match first
    if (productModel === priceModel) return true;

    // Try partial matching for common cases (e.g., 'IPHONE 15 PRO' vs 'IPHONE 15 PRO MAX')
    // This logic might need refinement based on exact matching rules
    if (productModel.includes(priceModel) || priceModel.includes(productModel)) {
      return true;
    }
    
    return false;
  };

  // Match products to prices
  const matchProducts = () => {
    const prices = parsePriceList(priceList);
    const products = parseProductList(productList);
    
    const results = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    let lastCategory = null;

    for (const product of products) {
      const productCapacity = extractCapacity(product.description);
      const requiresCapacity = needsCapacityMatch(product.description);
      
      let matchedPrice = null;

      for (const price of prices) {
        if (price.category !== product.category) continue;

        // Check if this specific price item needs color matching
        const requiresColor = needsColorMatch(product.category, price.model);
        
        const productModel = extractModelName(product.description, !requiresColor);
        const priceModel = extractModelName(price.model, !requiresColor);
        
        if (!modelsMatch(productModel, priceModel)) {
          continue;
        }
        
        if (requiresCapacity) {
          // If price.capacity is empty, extract from price.model
          const priceCapacity = price.capacity || extractCapacity(price.model);
          if (priceCapacity && productCapacity && priceCapacity !== productCapacity) {
            continue;
          }
        }

        matchedPrice = price;
        break;
      }

      if (matchedPrice !== null) {
        // Add double line break between different categories
        if (lastCategory !== null && lastCategory !== product.category) {
          results.push('');  // Empty line
          results.push('');  // Second empty line
        }
        
        // Use remarks from parsed product data (B欄備註)
        const remarks = product.remarks || '';
        
        // Apply deductions
        const deductedPrice = applyDeductions(matchedPrice.price, remarks);
        
        results.push(`${product.lineNum}\t${deductedPrice}`);
        matchedCount++;
        lastCategory = product.category;
      } else {
        unmatchedCount++;
        // Don't add unmatched lines to results
      }
    }

    setMatchResult(results.join('\n'));
    console.log('Match result updated:', results.join('\n'));
    setStats({ matched: matchedCount, unmatched: unmatchedCount, total: products.length });
  };

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(matchResult);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const toggleLock = () => {
    setIsLocked(!isLocked);
    // If toggling to locked mode, process matching immediately
    if (!isLocked) {
      processLockedMatching();
    } else {
      setLockedResult(''); // Clear locked result when unlocking
    }
  };

  const downloadResult = () => {
    const blob = new Blob([matchResult], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'price_match_result.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="App">
      <Card className="w-full max-w-4xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">產品價格匹配系統</CardTitle>
          <CardDescription className="text-center">自動匹配產品列表與價格，快速生成報價結果</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">第一步: 輸入價格列表</h2>
              <p className="text-sm text-gray-500 mb-2">貼上您的 PRICE LIST (格式: 類別、型號、容量/Part Number、數量、價格)</p>
              <Textarea
                placeholder="貼上價格列表..."
                value={priceList}
                onChange={(e) => setPriceList(e.target.value)}
                rows={10}
                className="font-mono"
              />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2 flex items-center justify-between">
                <span>第二步: 輸入產品列表</span>
                <Button
                  variant={isLocked ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleLock}
                  className="ml-2"
                >
                  {isLocked ? <Lock className="h-4 w-4 mr-2" /> : <Unlock className="h-4 w-4 mr-2" />}
                  {isLocked ? '有鎖' : '解鎖'}
                </Button>
              </h2>
              <p className="text-sm text-gray-500 mb-2">貼上您的 LIST (格式: 行號、產品描述, 支援備註欄)</p>
              <Textarea
                placeholder="貼上產品列表..."
                value={productList}
                onChange={(e) => setProductList(e.target.value)}
                rows={10}
                className="font-mono"
              />
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-2">匹配結果</h2>
            <p className="text-sm text-gray-500 mb-2">系統已完成自動匹配</p>
            <Textarea
              value={isLocked ? lockedResult : matchResult}
              readOnly
              rows={10}
              className="font-mono bg-gray-50"
            />
            <div className="flex justify-end mt-2 space-x-2">
              <Button onClick={copyToClipboard} disabled={!matchResult}>
                {copied ? <Check className="h-4 w-4 mr-2" /> : null}複製結果
              </Button>
              <Button variant="outline" onClick={downloadResult} disabled={!matchResult}>下載結果</Button>
              <Button variant="destructive" onClick={clearAll}>清除</Button>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600 text-center">
            <p>匹配成功: {stats.matched} | 匹配失敗: {stats.unmatched} | 總計: {stats.total}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;

