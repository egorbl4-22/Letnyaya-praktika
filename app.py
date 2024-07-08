from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3

app = Flask(__name__)
CORS(app)  # Разрешаем CORS для всех маршрутов

def get_db_connection():
    conn = sqlite3.connect('flight.db')
    conn.row_factory = sqlite3.Row
    return conn

def get_unique_cities():
    conn = sqlite3.connect('flight.db')
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT departure_city FROM flights UNION SELECT DISTINCT arrival_city FROM flights")
    cities = cursor.fetchall()
    conn.close()
    return [city[0] for city in cities]

@app.route('/api/cities', methods=['GET'])
def cities():
    cities = get_unique_cities()
    return jsonify(cities)

@app.route('/api/airlines', methods=['GET'])
def get_airlines():
    conn = get_db_connection()
    from_city = request.args.get('from')
    to_city = request.args.get('to')
    date = request.args.get('date')

    query = '''
SELECT airline_name, departure_airport, arrival_airport, 
       COUNT(*) AS total_flights,
       SUM(CASE WHEN (JULIANDAY(fact_arrival) - JULIANDAY(plan_arrival)) * 1440 <= 15 THEN 1 ELSE 0 END) AS on_time_flights,
       COUNT(*) AS flight_count,
       AVG(ROUND((JULIANDAY(fact_departure) - JULIANDAY(plan_departure)) * 1440)) + 
       AVG(ROUND((JULIANDAY(fact_arrival) - JULIANDAY(plan_arrival)) * 1440)) AS summary
FROM flights
WHERE departure_city = ? AND arrival_city = ? AND date(plan_departure) >= ?
GROUP BY airline_name
ORDER BY summary;
    '''
    flights = conn.execute(query, (from_city, to_city, date)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in flights])

@app.route('/api/flight-frequency', methods=['GET'])
def get_flight_frequency():
    conn = get_db_connection()
    airline_name = request.args.get('airline')

    query = '''
    SELECT strftime('%Y-%m', plan_departure) AS month, COUNT(*) AS flight_count
    FROM flights
    WHERE airline_name = ?
    GROUP BY month
    ORDER BY month;
    '''
    flights = conn.execute(query, (airline_name,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in flights])

@app.route('/api/all-airlines', methods=['GET'])
def get_all_airlines():
    conn = get_db_connection()
    query = '''
WITH flight_stats AS (
    SELECT 
        airline_name,
        COUNT(*) AS total_flights,
        SUM(CASE WHEN (JULIANDAY(fact_arrival) - JULIANDAY(plan_arrival)) * 1440 <= 15 THEN 1 ELSE 0 END) AS on_time_flights
    FROM flights
    GROUP BY airline_name
),
min_max_values AS (
    SELECT 
        MIN((on_time_flights * 1.0 / total_flights)) AS min_ratio,
        MAX((on_time_flights * 1.0 / total_flights)) AS max_ratio
    FROM flight_stats
)
SELECT 
    fs.airline_name,
    fs.on_time_flights,
    fs.total_flights,
    (on_time_flights * 1.0 / total_flights) AS on_time_ratio,
    ROUND(
        ((on_time_flights * 1.0 / total_flights) - mm.min_ratio) / (mm.max_ratio - mm.min_ratio) * (5 - 1) + 1,
        2
    ) AS rating
FROM flight_stats fs
CROSS JOIN min_max_values mm
ORDER BY rating DESC;
    '''
    airlines = conn.execute(query).fetchall()
    conn.close()
    return jsonify([dict(row) for row in airlines])



if __name__ == '__main__':
    app.run(debug=True)