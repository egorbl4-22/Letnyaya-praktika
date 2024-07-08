document.addEventListener('DOMContentLoaded', function() {
    // Fetch all airlines on page load
    fetch('http://127.0.0.1:5000/api/all-airlines')
        .then(response => response.json())
        .then(data => {
            displayAllAirlines(data);
            setupAirlineSelect(data);
        })
        .catch(error => console.error('Error:', error));

    // Handle flight search form submission
    document.getElementById('flight-search').addEventListener('submit', function(event) {
        event.preventDefault();
        const from = document.getElementById('from').value;
        const to = document.getElementById('to').value;
        const date = document.getElementById('date').value;

        fetch(`http://127.0.0.1:5000/api/airlines?from=${from}&to=${to}&date=${date}`)
            .then(response => response.json())
            .then(data => displayResults(data))
            .catch(error => console.error('Error:', error));
    });

    // Fetch cities for the dropdowns
    fetch('http://127.0.0.1:5000/api/cities')
        .then(response => response.json())
        .then(cities => {
            const fromSelect = document.getElementById('from');
            const toSelect = document.getElementById('to');

            cities.forEach(city => {
                const option = document.createElement('option');
                option.value = city;
                option.text = city;
                fromSelect.appendChild(option.cloneNode(true));
                toSelect.appendChild(option);
            });
        })
        .catch(error => console.error('Error:', error));
});

function setupAirlineSelect(airlines) {
    const airlineSelect = document.getElementById('airline-select');
    airlines.forEach(airline => {
        const option = document.createElement('option');
        option.value = airline.airline_name;
        option.text = airline.airline_name;
        airlineSelect.appendChild(option);
    });

    const updateButton = document.getElementById('update-chart');
    updateButton.addEventListener('click', function() {
        const selectedAirlines = Array.from(airlineSelect.selectedOptions, option => option.value);
        fetchFlightFrequencies(selectedAirlines);
    });

    // Initialize the chart with the first airline
    if (airlines.length > 0) {
        fetchFlightFrequencies([airlines[0].airline_name]);
    }
}

function fetchFlightFrequencies(airlineNames) {
    const promises = airlineNames.map(airlineName => 
        fetch(`http://127.0.0.1:5000/api/flight-frequency?airline=${airlineName}`)
            .then(response => response.json())
    );

    Promise.all(promises)
        .then(dataArray => {
            const labels = dataArray[0].map(item => item.month);
            const datasets = dataArray.map((data, index) => ({
                label: airlineNames[index],
                data: data.map(item => item.flight_count),
                backgroundColor: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.2)`,
                borderColor: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 1)`,
                borderWidth: 1
            }));
            updateChart(labels, datasets);
        })
        .catch(error => console.error('Error:', error));
}

function updateChart(labels, datasets) {
    const ctx = document.getElementById('flight-frequency-chart').getContext('2d');
    const existingChart = Chart.getChart(ctx);
    if (existingChart) {
        existingChart.destroy();
    }

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function displayAllAirlines(data) {
    const allAirlinesList = document.getElementById('all-airlines-list');
    allAirlinesList.innerHTML = '';

    // Найдем минимальный и максимальный рейтинг
    const ratings = data.map(airline => airline.rating);
    const min_rating = Math.min(...ratings);
    const max_rating = Math.max(...ratings);

    data.forEach(airline => {
        const airlineItem = document.createElement('div');
        airlineItem.classList.add('airline-item');

        // Переведем рейтинг в пятибальную шкалу
        const five_star_rating = 1 + 4 * ((airline.rating - min_rating) / (max_rating - min_rating));

        airlineItem.innerHTML = `
            <h3>${airline.airline_name}</h3>
            <p>Количество перелетов: ${airline.total_flights}</p>
            <div class="stars">${generateStars(five_star_rating.toFixed(2))}</div>
        `;
        allAirlinesList.appendChild(airlineItem);
    });
}

function displayResults(data) {
    const airlinesList = document.getElementById('airlines-list');
    airlinesList.innerHTML = '';

    // Вычисляем коэффициент для каждой авиакомпании
    data.forEach(flight => {
        flight.coefficient = flight.on_time_flights / flight.total_flights;
    });

    // Сортируем авиакомпании по коэффициенту в порядке убывания
    data.sort((a, b) => b.coefficient - a.coefficient);

    data.forEach((flight, index) => {
        const flightItem = document.createElement('div');
        flightItem.classList.add('flight-item');

        // Добавляем значки медалек для первых трех авиакомпаний
        let medalIcon = '';
        if (index === 0) {
            medalIcon = '<span class="medal-icon gold">🥇<span class="annotation">Эта компания чаще всего прилетает вовремя</span></span></span>';
        } else if (index === 1) {
            medalIcon = '<span class="medal-icon silver">🥈</span>';
        } else if (index === 2) {
            medalIcon = '<span class="medal-icon bronze">🥉</span>';
        }

        // Добавляем значок для компаний с задержкой менее 25 минут
        const delayIcon = flight.summary < 25 ? '<span class="delay-icon">⏱️</span>' : '';

        flightItem.innerHTML = `
            <h3>${medalIcon}${delayIcon}${flight.airline_name}</h3>
            <p>Отправка из: ${flight.departure_airport}, Прибытие: ${flight.arrival_airport}, Средняя задержка рейса: ${flight.summary.toFixed(2)}, Количество перелетов: ${flight.flight_count}</p>
        `;

        airlinesList.appendChild(flightItem);
    });
}

function generateStars(rating) {
    let stars = '';
    const fullStars = Math.floor(rating); // Количество полных звезд
    const hasHalfStar = rating % 1 !== 0; // Есть ли половина звезды

    for (let i = 0; i < fullStars; i++) {
        stars += '<span class="star">★</span>';
    }

    if (hasHalfStar) {
        stars += '<span class="star">✫</span>'; // Добавляем половину звезды, если есть
    }

    for (let i = fullStars + (hasHalfStar ? 1 : 0); i < 5; i++) {
        stars += '<span class="star">☆</span>';
    }

    return stars;
}

document.getElementById('flight-search').addEventListener('submit', function(event) {
    event.preventDefault(); // Предотвращаем стандартное поведение формы
    const airlinesList = document.getElementById('airlines-list');
    airlinesList.scrollIntoView({ behavior: 'smooth' }); // Плавный скролл к элементу airlines-list
});