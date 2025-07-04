// Trading Instrument Verification Utility
// Compares Kite and Upstox instrument codes and identifies discrepancies

export interface InstrumentMapping {
  kiteSymbol: string
  upstoxSymbol: string
  isin?: string
  instrumentType: 'equity' | 'future' | 'currency' | 'commodity' | 'index'
  verified: boolean
  notes?: string
}

export const VERIFIED_INSTRUMENT_MAPPINGS: InstrumentMapping[] = [
  {
    kiteSymbol: "BHEL",
    upstoxSymbol: "NSE_EQ|INE257A01026",
    isin: "INE257A01026",
    instrumentType: "equity",
    verified: true,
    notes: "ISIN matches - Bharat Heavy Electricals Limited"
  },
  {
    kiteSymbol: "RELIANCE", 
    upstoxSymbol: "BSE_EQ|INE002A01018",
    isin: "INE002A01018",
    instrumentType: "equity",
    verified: true,
    notes: "ISIN matches - Reliance Industries Limited"
  },
  {
    kiteSymbol: "SENSEX25708FUT",
    upstoxSymbol: "BSE_FO|824914",
    instrumentType: "index",
    verified: true,
    notes: "BSE SENSEX July 2025 Future - Reference number 824914"
  },
  {
    kiteSymbol: "CRUDEOIL25JULFUT",
    upstoxSymbol: "MCX_FO|447552", 
    instrumentType: "commodity",
    verified: true,
    notes: "MCX Crude Oil July 2025 Future - Reference number 447552"
  },
  {
    kiteSymbol: "NIFTY25JULFUT",
    upstoxSymbol: "NSE_FO|53216",
    instrumentType: "index", 
    verified: true,
    notes: "NSE NIFTY July 2025 Future - Reference number 53216"
  },
  {
    kiteSymbol: "USDINR25JULFUT",
    upstoxSymbol: "NCD_FO|1229",
    instrumentType: "currency",
    verified: true,
    notes: "USD/INR July 2025 Future - Reference number 1229"
  }
]

export interface PriceDiscrepancy {
  instrumentName: string
  kitePrice: number | null
  upstoxPrice: number | null
  difference: number | null
  percentageDiff: number | null
  status: 'matched' | 'discrepancy' | 'missing_kite' | 'missing_upstox' | 'both_missing'
  severity: 'low' | 'medium' | 'high'
}

export function analyzePriceDiscrepancies(
  kiteTicks: any[],
  upstoxTicks: any[]
): PriceDiscrepancy[] {
  const discrepancies: PriceDiscrepancy[] = []

  VERIFIED_INSTRUMENT_MAPPINGS.forEach(mapping => {
    // Find corresponding ticks
    const kiteTick = kiteTicks.find(tick => 
      tick.tradingsymbol === mapping.kiteSymbol ||
      getInstrumentNameFromToken(tick.instrument_token) === mapping.kiteSymbol
    )
    
    const upstoxTick = upstoxTicks.find(tick =>
      tick.instrument_token === mapping.upstoxSymbol ||
      tick.instrument_key === mapping.upstoxSymbol
    )

    const kitePrice = kiteTick?.last_price || null
    const upstoxPrice = upstoxTick?.last_price || null

    let status: PriceDiscrepancy['status'] = 'both_missing'
    let difference: number | null = null
    let percentageDiff: number | null = null
    let severity: PriceDiscrepancy['severity'] = 'low'

    if (kitePrice !== null && upstoxPrice !== null) {
      difference = Math.abs(kitePrice - upstoxPrice)
      percentageDiff = upstoxPrice !== 0 ? (difference / upstoxPrice) * 100 : 0
      
      if (difference < 0.01) {
        status = 'matched'
        severity = 'low'
      } else if (percentageDiff < 0.1) {
        status = 'discrepancy'
        severity = 'low'
      } else if (percentageDiff < 1.0) {
        status = 'discrepancy'
        severity = 'medium'
      } else {
        status = 'discrepancy'
        severity = 'high'
      }
    } else if (kitePrice !== null && upstoxPrice === null) {
      status = 'missing_upstox'
      severity = 'medium'
    } else if (kitePrice === null && upstoxPrice !== null) {
      status = 'missing_kite'
      severity = 'medium'
    }

    discrepancies.push({
      instrumentName: mapping.kiteSymbol,
      kitePrice,
      upstoxPrice,
      difference,
      percentageDiff,
      status,
      severity
    })
  })

  return discrepancies
}

function getInstrumentNameFromToken(token: number): string {
  const tokenMap: Record<number, string> = {
    256265: "NIFTY25JULFUT",
    265: "SENSEX25708FUT", 
    128083204: "RELIANCE",
    281836549: "BHEL",
    408065: "USDINR25JULFUT",
    134657: "CRUDEOIL25JULFUT",
  }
  return tokenMap[token] || `TOKEN_${token}`
}

export function generateVerificationReport(discrepancies: PriceDiscrepancy[]): string {
  const report = [
    "=== INSTRUMENT VERIFICATION REPORT ===\n",
    "Timestamp: " + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + "\n"
  ]

  // Summary
  const matched = discrepancies.filter(d => d.status === 'matched').length
  const withDiscrepancies = discrepancies.filter(d => d.status === 'discrepancy').length
  const missingKite = discrepancies.filter(d => d.status === 'missing_kite').length
  const missingUpstox = discrepancies.filter(d => d.status === 'missing_upstox').length
  const bothMissing = discrepancies.filter(d => d.status === 'both_missing').length

  report.push("\n--- SUMMARY ---")
  report.push(`Total Instruments: ${discrepancies.length}`)
  report.push(`✅ Matched Prices: ${matched}`)
  report.push(`⚠️  Price Discrepancies: ${withDiscrepancies}`)
  report.push(`❌ Missing Kite Data: ${missingKite}`)
  report.push(`❌ Missing Upstox Data: ${missingUpstox}`)
  report.push(`❌ Both Missing: ${bothMissing}`)

  // Detailed breakdown
  report.push("\n--- DETAILED ANALYSIS ---")
  
  discrepancies.forEach(disc => {
    report.push(`\n${disc.instrumentName}:`)
    report.push(`  Kite Price: ${disc.kitePrice !== null ? `₹${disc.kitePrice.toFixed(2)}` : 'N/A'}`)
    report.push(`  Upstox Price: ${disc.upstoxPrice !== null ? `₹${disc.upstoxPrice.toFixed(2)}` : 'N/A'}`)
    
    if (disc.difference !== null) {
      report.push(`  Difference: ₹${disc.difference.toFixed(2)} (${disc.percentageDiff?.toFixed(4)}%)`)
    }
    
    report.push(`  Status: ${disc.status.toUpperCase()}`)
    report.push(`  Severity: ${disc.severity.toUpperCase()}`)
  })

  return report.join('\n')
}

// Based on the image analysis, here are the current observations:
export const CURRENT_PRICE_ANALYSIS = {
  timestamp: "2025-01-08 13:01:00 IST",
  observations: [
    {
      instrument: "BHEL",
      kite: null, // N/A in image
      upstox: 258.90,
      status: "missing_kite",
      note: "Kite data not available"
    },
    {
      instrument: "RELIANCE", 
      kite: 1521.50,
      upstox: 1521.50,
      status: "matched",
      note: "Perfect price match"
    },
    {
      instrument: "CRUDEOIL25JULFUT",
      kite: null, // N/A in image
      upstox: 5720.00,
      status: "missing_kite", 
      note: "Kite data not available"
    },
    {
      instrument: "USDINR25JULFUT",
      kite: null, // N/A in image
      upstox: 85.50,
      status: "missing_kite",
      note: "Kite data not available"
    },
    {
      instrument: "SENSEX25708FUT",
      kite: null, // N/A in image
      upstox: 83075.00,
      status: "missing_kite",
      note: "Kite data not available"
    },
    {
      instrument: "NIFTY25JULFUT",
      kite: null, // N/A in image  
      upstox: 25438.40,
      status: "missing_kite",
      note: "Kite data not available"
    }
  ]
}