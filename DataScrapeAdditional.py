import pandas as pd
import yfinance as yf
from datetime import datetime
import os
import time
import random
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("additional_stocks.log"),
        logging.StreamHandler()
    ]
)

# List of 25 additional Indian stocks (different from the original 25)
ADDITIONAL_STOCKS = [
    {"name": "Tata Motors", "nse": "TATAMOTORS.NS", "bse": "TATAMOTORS.BO"},
    {"name": "Tata Steel", "nse": "TATASTEEL.NS", "bse": "TATASTEEL.BO"},
    {"name": "Mahindra & Mahindra", "nse": "M&M.NS", "bse": "M&M.BO"},
    {"name": "Bajaj Finserv", "nse": "BAJAJFINSV.NS", "bse": "BAJAJFINSV.BO"},
    {"name": "Tech Mahindra", "nse": "TECHM.NS", "bse": "TECHM.BO"},
    {"name": "UltraTech Cement", "nse": "ULTRACEMCO.NS", "bse": "ULTRACEMCO.BO"},
    {"name": "Grasim Industries", "nse": "GRASIM.NS", "bse": "GRASIM.BO"},
    {"name": "NTPC", "nse": "NTPC.NS", "bse": "NTPC.BO"},
    {"name": "JSW Steel", "nse": "JSWSTEEL.NS", "bse": "JSWSTEEL.BO"},
    {"name": "IndusInd Bank", "nse": "INDUSINDBK.NS", "bse": "INDUSINDBK.BO"},
    {"name": "Cipla", "nse": "CIPLA.NS", "bse": "CIPLA.BO"},
    {"name": "Dr Reddy's Laboratories", "nse": "DRREDDY.NS", "bse": "DRREDDY.BO"},
    {"name": "SBI Life Insurance", "nse": "SBILIFE.NS", "bse": "SBILIFE.BO"},
    {"name": "Adani Power", "nse": "ADANIPOWER.NS", "bse": "ADANIPOWER.BO"},
    {"name": "Britannia Industries", "nse": "BRITANNIA.NS", "bse": "BRITANNIA.BO"},
    {"name": "Hindalco Industries", "nse": "HINDALCO.NS", "bse": "HINDALCO.BO"},
    {"name": "Eicher Motors", "nse": "EICHERMOT.NS", "bse": "EICHERMOT.BO"},
    {"name": "Bharat Petroleum", "nse": "BPCL.NS", "bse": "BPCL.BO"},
    {"name": "Coal India", "nse": "COALINDIA.NS", "bse": "COALINDIA.BO"},
    {"name": "Tata Consumer Products", "nse": "TATACONSUM.NS", "bse": "TATACONSUM.BO"},
    {"name": "Hero MotoCorp", "nse": "HEROMOTOCO.NS", "bse": "HEROMOTOCO.BO"},
    {"name": "Divi's Laboratories", "nse": "DIVISLAB.NS", "bse": "DIVISLAB.BO"},
    {"name": "ONGC", "nse": "ONGC.NS", "bse": "ONGC.BO"},
    {"name": "Indian Oil Corporation", "nse": "IOC.NS", "bse": "IOC.BO"},
    {"name": "Shree Cement", "nse": "SHREECEM.NS", "bse": "SHREECEM.BO"}
]

def create_data_folder():
    """Create folder for storing data"""
    if not os.path.exists("data"):
        os.makedirs("data")
        logging.info("Created folder: data")

def fetch_stock_data(stock_info, start_date='2000-01-01', end_date=None):
    """
    Fetch daily historical stock data and save it to CSV
    
    Parameters:
    stock_info (dict): Dictionary containing stock name and tickers
    start_date (str): Start date in 'YYYY-MM-DD' format
    end_date (str): End date in 'YYYY-MM-DD' format
    
    Returns:
    bool: True if successful, False otherwise
    """
    if end_date is None:
        end_date = datetime.now().strftime('%Y-%m-%d')
    
    # Create a filename-friendly version of the stock name
    safe_name = stock_info['name'].replace(" ", "_").replace("&", "and").lower()
    filename = f"data/{safe_name}_daily.csv"
    
    # Try different ticker formats and exchanges
    tickers_to_try = [
        stock_info["nse"],                    # NSE format
        stock_info["bse"],                    # BSE format
        stock_info["nse"].replace(".NS", ""), # Plain ticker without exchange
        stock_info["name"].replace(" ", ".")  # Alternative format
    ]
    
    for ticker in tickers_to_try:
        logging.info(f"Fetching data for {stock_info['name']} ({ticker}) from {start_date} to {end_date}...")
        
        try:
            # Add a delay before each request to avoid rate limiting
            time.sleep(random.uniform(1.5, 3))
            
            # Set a timeout for download to prevent hanging
            data = yf.download(
                ticker, 
                start=start_date, 
                end=end_date, 
                interval='1d', 
                progress=False,
                timeout=45,
                ignore_tz=True
            )
            
            if len(data) > 0:
                logging.info(f"Successfully retrieved {len(data)} records for {ticker}")
                
                # Save to CSV
                data.reset_index(inplace=True)
                data.to_csv(filename, index=False)
                logging.info(f"Data saved to {filename}")
                return True
            
        except Exception as e:
            logging.error(f"Error fetching data for {ticker}: {str(e)}")
            # Continue to next ticker attempt
    
    # If we've tried all tickers and none worked
    logging.warning(f"Failed to retrieve data for {stock_info['name']}")
    return False

def verify_yfinance_connection():
    """Test connection to Yahoo Finance API"""
    try:
        test_data = yf.download('AAPL', period='1d', progress=False)
        if len(test_data) > 0:
            logging.info("Yahoo Finance API connection successful")
            return True
        else:
            logging.error("Yahoo Finance API connection test returned no data")
            return False
    except Exception as e:
        logging.error(f"Yahoo Finance API connection test failed: {str(e)}")
        return False

def main():
    try:
        logging.info("Starting additional stocks data scraper")
        
        # Create necessary folder
        create_data_folder()
        
        # Verify API connection before proceeding
        if not verify_yfinance_connection():
            logging.error("Cannot connect to Yahoo Finance API. Please check your internet connection or try again later.")
            return
        
        # Get current date for end_date
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Process each stock and track results
        successful_count = 0
        failed_stocks = []
        total_count = len(ADDITIONAL_STOCKS)
        
        for i, stock in enumerate(ADDITIONAL_STOCKS):
            logging.info(f"Processing stock {i+1}/{total_count}: {stock['name']} ({successful_count} successful so far)")
            
            try:
                success = fetch_stock_data(stock, start_date='2000-01-01', end_date=today)
                
                if success:
                    successful_count += 1
                else:
                    failed_stocks.append(stock['name'])
                    
                logging.info(f"Completed processing {stock['name']} (Success: {success})")
                
                # Add delay between stocks to avoid API blocks
                if i < total_count - 1:  # Skip delay after the last stock
                    delay = random.uniform(3, 6)
                    logging.info(f"Waiting {delay:.2f} seconds before next stock...\n")
                    time.sleep(delay)
                    
            except Exception as e:
                logging.error(f"Unexpected error processing {stock['name']}: {str(e)}")
                failed_stocks.append(stock['name'])
        
        # Print final status
        logging.info(f"Process completed. Successfully retrieved data for {successful_count} out of {total_count} stocks.")
        
        if failed_stocks:
            logging.info(f"Failed stocks: {', '.join(failed_stocks)}")
        
        if successful_count > 0:
            logging.info("Data is available in the 'data' folder.")
        
    except Exception as e:
        logging.error(f"Critical error in main process: {str(e)}")

if __name__ == "__main__":
    main()