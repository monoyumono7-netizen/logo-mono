"""Generate sample K-line CSV data for Kronos demo."""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def generate_kline_data(
    symbol: str,
    start_price: float,
    volatility: float,
    num_bars: int = 600,
    interval_minutes: int = 5,
    avg_volume: float = 100.0,
):
    np.random.seed(42 if symbol == "BTC_USDT" else 123)
    timestamps = []
    opens, highs, lows, closes, volumes, amounts = [], [], [], [], [], []

    start_time = datetime(2025, 12, 1, 0, 0, 0)
    price = start_price

    for i in range(num_bars):
        ts = start_time + timedelta(minutes=interval_minutes * i)
        timestamps.append(ts)

        open_price = price
        change = np.random.normal(0, volatility)
        close_price = open_price * (1 + change)

        intra_high = max(open_price, close_price) * (1 + abs(np.random.normal(0, volatility * 0.3)))
        intra_low = min(open_price, close_price) * (1 - abs(np.random.normal(0, volatility * 0.3)))

        vol = avg_volume * (1 + abs(np.random.normal(0, 0.5)))
        amt = vol * (open_price + close_price) / 2

        opens.append(round(open_price, 2))
        highs.append(round(intra_high, 2))
        lows.append(round(intra_low, 2))
        closes.append(round(close_price, 2))
        volumes.append(round(vol, 4))
        amounts.append(round(amt, 4))

        price = close_price

    df = pd.DataFrame({
        "timestamps": timestamps,
        "open": opens,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": volumes,
        "amount": amounts,
    })
    return df


if __name__ == "__main__":
    btc = generate_kline_data("BTC_USDT", start_price=96000, volatility=0.003, avg_volume=2.5)
    btc.to_csv("data/BTC_USDT_5min.csv", index=False)
    print(f"BTC_USDT: {len(btc)} bars, price range {btc['low'].min():.2f} - {btc['high'].max():.2f}")

    eth = generate_kline_data("ETH_USDT", start_price=3500, volatility=0.004, avg_volume=30.0)
    eth.to_csv("data/ETH_USDT_5min.csv", index=False)
    print(f"ETH_USDT: {len(eth)} bars, price range {eth['low'].min():.2f} - {eth['high'].max():.2f}")
