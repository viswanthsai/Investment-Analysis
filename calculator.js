document.addEventListener('DOMContentLoaded', async () => {
    // DOM elements
    const stockSelect = document.getElementById('stock-select');
    const calculatorForm = document.getElementById('calculator-form');
    const resultsSection = document.getElementById('results');
    
    // Results elements
    const initialInvestmentEl = document.getElementById('initial-investment');
    const currentValueEl = document.getElementById('current-value');
    const totalReturnEl = document.getElementById('total-return');
    const returnPercentEl = document.getElementById('return-percent');
    const cagrEl = document.getElementById('cagr');
    const investmentPeriodEl = document.getElementById('investment-period');
    const benchmarkEl = document.getElementById('benchmark');
    
    // Set default dates
    const today = new Date();
    const defaultStartDate = new Date(2000, 0, 1); // Jan 1, 2000
    
    document.getElementById('end-date').valueAsDate = today;
    document.getElementById('investment-date').valueAsDate = defaultStartDate;
    
    // Fetch available stocks
    const stocksList = await fetchStocksList();
    populateStockSelect(stocksList);
    
    // Add this new variable
    let corporateActions = {};
    
    // Load corporate actions data
    try {
        const response = await fetch('corporate_actions.json');
        corporateActions = await response.json();
    } catch (error) {
        console.error('Error loading corporate actions:', error);
        corporateActions = {};
    }
    
    // Event listeners
    calculatorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const stockName = stockSelect.value;
        const amount = parseFloat(document.getElementById('amount').value);
        const investmentDate = new Date(document.getElementById('investment-date').value);
        const endDate = new Date(document.getElementById('end-date').value);
        
        if (!stockName || !amount || isNaN(amount) || amount <= 0) {
            alert('Please select a stock and enter a valid investment amount.');
            return;
        }
        
        try {
            // Show loading state
            calculatorForm.querySelector('button').textContent = 'Calculating...';
            calculatorForm.querySelector('button').disabled = true;
            
            // Fetch stock data
            const stockData = await fetchStockData(stockName);
            
            // Log stock data count and range for debugging
            if (stockData.length > 0) {
                console.log(`Loaded ${stockData.length} data points for ${stockName}`);
                console.log(`Date range: ${stockData[0].date.toLocaleDateString()} to ${stockData[stockData.length-1].date.toLocaleDateString()}`);
            } else {
                console.warn(`No data points loaded for ${stockName}`);
            }
            
            // Calculate returns
            const result = calculateReturns(stockData, amount, investmentDate, endDate);
            
            // Display results and chart
            displayResults(result);
            createGrowthChart(stockData, amount, investmentDate, endDate);
            
        } catch (error) {
            console.error('Error calculating returns:', error);
            let errorMsg = error.message || 'Unknown error';
            
            if (error instanceof TypeError && error.message.includes('is not defined')) {
                errorMsg = 'Internal calculation error: Missing function definition';
            } else if (errorMsg.includes('Invalid time value')) {
                errorMsg = 'Date parsing error. The stock data contains invalid date formats.';
            }
            
            alert(`Calculation error: ${errorMsg}`);
            
        } finally {
            // Always reset button
            calculatorForm.querySelector('button').textContent = 'Calculate Returns';
            calculatorForm.querySelector('button').disabled = false;
        }
    });
    
    // Functions
    async function fetchStocksList() {
        try {
            const response = await fetch('stocklist.json');
            return await response.json();
        } catch (error) {
            console.error('Error fetching stocks list:', error);
            return [];
        }
    }
    
    function populateStockSelect(stocks) {
        stocks.forEach(stock => {
            const option = document.createElement('option');
            option.value = stock.filename;
            option.textContent = stock.name;
            stockSelect.appendChild(option);
        });
    }
    
    async function fetchStockData(stockFilename) {
        try {
            // Make sure we're appending .csv if not already included
            const filename = stockFilename.endsWith('.csv') ? stockFilename : `${stockFilename}_daily.csv`;
            const response = await fetch(`data/${filename}`);
            
            if (!response.ok) {
                console.error(`Failed to fetch ${filename}: ${response.status} ${response.statusText}`);
                throw new Error(`Stock data file not found (${response.status})`);
            }
            
            const csvText = await response.text();
            
            // Check if CSV has minimum content
            if (csvText.trim().length < 10) {
                console.error(`CSV file for ${stockFilename} is empty or too small`);
                throw new Error('Stock data file is empty');
            }
            
            try {
                return parseCSV(csvText);
            } catch (parseError) {
                console.error(`Error parsing CSV for ${stockFilename}:`, parseError);
                throw new Error('Unable to parse stock data file');
            }
        } catch (error) {
            console.error('Error fetching stock data:', error);
            throw error; // Keep original message
        }
    }
    
    function parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        
        const dateIndex = headers.indexOf('Date');
        const closeIndex = headers.indexOf('Close');
        
        if (dateIndex === -1 || closeIndex === -1) {
            throw new Error('Invalid CSV format: Missing Date or Close columns');
        }
        
        const data = [];
        let errorLine = null;
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            
            if (values.length >= Math.max(dateIndex, closeIndex) + 1) {
                try {
                    // Get the date string and try to parse it
                    const dateStr = values[dateIndex].trim();
                    const closeVal = parseFloat(values[closeIndex]);
                    
                    // Handle various date formats
                    let dateObj;
                    
                    // Try direct parsing first
                    dateObj = new Date(dateStr);
                    
                    // Make sure the date is valid
                    if (isNaN(dateObj.getTime())) {
                        // If direct parsing fails, try alternative formats
                        // For example, if CSV has DD-MM-YYYY format
                        const parts = dateStr.split(/[-/]/);
                        if (parts.length === 3) {
                            // Try YYYY-MM-DD or DD-MM-YYYY
                            if (parts[0].length === 4) {
                                // YYYY-MM-DD
                                dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                            } else {
                                // DD-MM-YYYY
                                dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                            }
                        }
                    }
                    
                    // Final check that date is valid
                    if (!isNaN(dateObj.getTime()) && !isNaN(closeVal)) {
                        data.push({
                            date: dateObj,
                            close: closeVal
                        });
                    } else {
                        console.warn(`Skipping invalid data at line ${i+1}: Date=${dateStr}, Close=${values[closeIndex]}`);
                    }
                } catch (error) {
                    console.error(`Error parsing line ${i+1}:`, error);
                    errorLine = i + 1;
                }
            }
        }
        
        if (data.length === 0) {
            throw new Error(`No valid data parsed from CSV${errorLine ? ` (first error on line ${errorLine})` : ''}`);
        }
        
        // Sort by date
        return data.sort((a, b) => a.date - b.date);
    }
    
    function calculateReturns(stockData, initialAmount, startDate, endDate) {
        // Check if we have enough data
        if (!stockData || stockData.length < 2) {
            throw new Error('Insufficient data points for calculation');
        }
        
        console.log(`Stock data range: ${stockData[0].date.toISOString()} to ${stockData[stockData.length-1].date.toISOString()}`);
        console.log(`Requested range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
        
        // Find closest prices to the start and end dates
        const startPrice = findClosestPrice(stockData, startDate);
        const endPrice = findClosestPrice(stockData, endDate);
        
        if (!startPrice) {
            throw new Error(`No data available near start date (${startDate.toDateString()})`);
        }
        
        if (!endPrice) {
            throw new Error(`No data available near end date (${endDate.toDateString()})`);
        }
        
        if (startPrice.close <= 0) {
            throw new Error(`Invalid starting price: ${startPrice.close} on ${startPrice.date.toDateString()}`);
        }
        
        console.log(`Using prices: Start - ${startPrice.date.toDateString()} (₹${startPrice.close}), End - ${endPrice.date.toDateString()} (₹${endPrice.close})`);
        
        // Calculate initial number of shares purchased
        let sharesPurchased = initialAmount / startPrice.close;
        
        // Get relevant corporate actions for this stock
        const stockFileName = stockSelect.value;
        const actions = corporateActions[stockFileName] || [];
        
        // Filter actions between start and end date
        const relevantActions = actions.filter(action => {
            const actionDate = new Date(action.date);
            return actionDate >= startDate && actionDate <= endDate;
        });
        
        // Apply corporate actions to adjust shares
        relevantActions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Keep track of share adjustments for the chart
        const shareAdjustments = [
            { date: startDate, shares: sharesPurchased, event: "Initial Investment" }
        ];
        
        relevantActions.forEach(action => {
            const prevShares = sharesPurchased;
            sharesPurchased *= action.factor;
            
            shareAdjustments.push({
                date: new Date(action.date),
                shares: sharesPurchased,
                event: action.description,
                factor: action.factor,
                prevShares: prevShares
            });
        });
        
        // Calculate final value with adjusted shares
        const finalValue = sharesPurchased * endPrice.close;
        
        // The rest of the calculation remains the same
        const absoluteReturn = finalValue - initialAmount;
        const returnPercentage = (absoluteReturn / initialAmount) * 100;
        
        const timeDiff = endDate.getTime() - startDate.getTime();
        const yearsDiff = timeDiff / (1000 * 60 * 60 * 24 * 365.25);
        
        const cagr = (Math.pow((finalValue / initialAmount), (1 / yearsDiff)) - 1) * 100;
        
        const fdRate = 6;
        const fdValue = initialAmount * Math.pow((1 + fdRate/100), yearsDiff);
        const fdComparison = ((finalValue - fdValue) / fdValue) * 100;
        
        // Generate growth data with adjusted shares
        const growthData = generateGrowthDataWithAdjustments(
            stockData, 
            initialAmount, 
            startDate, 
            endDate, 
            shareAdjustments
        );
        
        return {
            initialInvestment: initialAmount,
            finalValue,
            absoluteReturn,
            returnPercentage,
            startDate,
            endDate,
            yearsDiff,
            cagr,
            fdComparison,
            startPrice,
            endPrice,
            growthData
        };
    }
    
    function findClosestPrice(stockData, targetDate) {
        // Convert targetDate to timestamp for comparison
        const targetTime = targetDate.getTime();
        
        // Find the closest date in the data
        let closest = null;
        let minDiff = Infinity;
        
        for (const dataPoint of stockData) {
            const diff = Math.abs(dataPoint.date.getTime() - targetTime);
            
            if (diff < minDiff) {
                minDiff = diff;
                closest = dataPoint;
            }
        }
        
        return closest;
    }
    
    function generateGrowthData(stockData, sharesPurchased, startDate, endDate) {
        const startTime = startDate.getTime();
        const endTime = endDate.getTime();
        
        // Filter data within the range
        const filteredData = stockData.filter(
            point => point.date.getTime() >= startTime && point.date.getTime() <= endTime
        );
        
        // Generate monthly data points (to keep chart manageable)
        const monthlyData = [];
        let currentMonth = -1;
        
        filteredData.forEach(point => {
            const month = point.date.getMonth() + point.date.getFullYear() * 12;
            
            if (month !== currentMonth) {
                currentMonth = month;
                monthlyData.push({
                    date: point.date,
                    value: sharesPurchased * point.close
                });
            }
        });
        
        return monthlyData;
    }
    
    function generateGrowthDataWithAdjustments(stockData, initialAmount, startDate, endDate, shareAdjustments) {
        const startTime = startDate.getTime();
        const endTime = endDate.getTime();
        
        // Filter data within the range
        const filteredData = stockData.filter(
            point => point.date.getTime() >= startTime && point.date.getTime() <= endTime
        );
        
        if (filteredData.length === 0) {
            return [];
        }
        
        // Generate monthly data points with proper share adjustments
        const monthlyData = [];
        let currentMonth = -1;
        
        // Sort adjustments by date
        shareAdjustments.sort((a, b) => a.date.getTime() - b.date.getTime());
        
        filteredData.forEach(point => {
            const month = point.date.getMonth() + point.date.getFullYear() * 12;
            
            // Find the appropriate share count for this data point
            let currentShares = shareAdjustments[0].shares; // Start with initial shares
            
            // Apply all adjustments that occurred before this data point
            for (let i = 1; i < shareAdjustments.length; i++) {
                if (shareAdjustments[i].date.getTime() <= point.date.getTime()) {
                    currentShares = shareAdjustments[i].shares;
                } else {
                    break; // No need to check further adjustments
                }
            }
            
            if (month !== currentMonth) {
                currentMonth = month;
                monthlyData.push({
                    date: point.date,
                    value: currentShares * point.close,
                    shares: currentShares
                });
            }
        });
        
        return monthlyData;
    }
    
    function displayResults(result) {
        // Format numbers for display
        const formatter = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        });
        
        // Update DOM elements
        initialInvestmentEl.textContent = formatter.format(result.initialInvestment);
        currentValueEl.textContent = formatter.format(result.finalValue);
        
        // Set color based on return value
        const returnColor = result.absoluteReturn >= 0 ? 'text-green-600' : 'text-red-600';
        totalReturnEl.textContent = formatter.format(result.absoluteReturn);
        totalReturnEl.className = `text-2xl font-bold ${returnColor}`;
        
        returnPercentEl.textContent = `${result.returnPercentage.toFixed(2)}%`;
        returnPercentEl.className = result.returnPercentage >= 0 
            ? 'ml-2 px-2 py-1 text-sm bg-green-100 text-green-800 rounded'
            : 'ml-2 px-2 py-1 text-sm bg-red-100 text-red-800 rounded';
        
        cagrEl.textContent = `${result.cagr.toFixed(2)}%`;
        cagrEl.className = result.cagr >= 0 ? 'text-2xl font-bold text-blue-600' : 'text-2xl font-bold text-red-600';
        
        // Calculate years and months
        const years = Math.floor(result.yearsDiff);
        const months = Math.round((result.yearsDiff - years) * 12);
        investmentPeriodEl.textContent = `${years} years${months > 0 ? `, ${months} months` : ''}`;
        
        // Benchmark comparison text
        const comparisonText = result.fdComparison >= 0 
            ? `outperforms a fixed deposit by <span class="text-green-600 font-bold">${result.fdComparison.toFixed(2)}%</span>`
            : `underperforms a fixed deposit by <span class="text-red-600 font-bold">${Math.abs(result.fdComparison).toFixed(2)}%</span>`;
        benchmarkEl.innerHTML = `This ${comparisonText}`;
        
        // Show results section
        resultsSection.classList.remove('hidden');
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    function createGrowthChart(stockData, amount, startDate, endDate) {
        // Calculate result to get growth data
        const result = calculateReturns(stockData, amount, startDate, endDate);
        const { growthData } = result;
        
        // Prepare chart data
        const labels = growthData.map(point => {
            const date = point.date;
            return `${date.getMonth()+1}/${date.getFullYear().toString().substr(2)}`;
        });
        
        const values = growthData.map(point => point.value);
        
        // Get canvas context
        const ctx = document.getElementById('growth-chart').getContext('2d');
        
        // Destroy previous chart if exists
        if (window.growthChart instanceof Chart) {
            window.growthChart.destroy();
        }
        
        // Create new chart
        window.growthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Investment Value',
                    data: values,
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                return new Intl.NumberFormat('en-IN', {
                                    style: 'currency',
                                    currency: 'INR'
                                }).format(value);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toLocaleString('en-IN');
                            }
                        }
                    }
                }
            }
        });
    }
});