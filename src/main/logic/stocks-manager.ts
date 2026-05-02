import { IpcMain, app } from 'electron'
import path from 'path'
import fs from 'fs'

export default function registerStocksHandlers(ipcMain: IpcMain) {
  const STOCKS_FILE = path.resolve(app.getPath('userData'), 'stocks.json')

  ipcMain.handle('stocks-add', async (event, { symbol }) => {
    try {
      let stocks: any[] = []
      if (fs.existsSync(STOCKS_FILE)) {
        const data = fs.readFileSync(STOCKS_FILE, 'utf-8')
        stocks = JSON.parse(data)
      }

      // Mock stock data
      const mockPrice = (Math.random() * 1000 + 100).toFixed(2)
      const mockChange = ((Math.random() - 0.5) * 10).toFixed(2)

      const newStock = {
        symbol: symbol.toUpperCase(),
        price: `$${mockPrice}`,
        change: `${mockChange}%`
      }

      stocks.push(newStock)
      fs.writeFileSync(STOCKS_FILE, JSON.stringify(stocks, null, 2))

      return newStock
    } catch (error) {
      console.error('Add stock failed:', error)
      return null
    }
  })

  ipcMain.handle('stocks-list', async () => {
    try {
      if (!fs.existsSync(STOCKS_FILE)) return []

      const data = fs.readFileSync(STOCKS_FILE, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      console.error('List stocks failed:', error)
      return []
    }
  })
}
