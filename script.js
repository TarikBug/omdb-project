const API_KEY = "your_api_key_here"; // Replace with your actual OMDb API key

const movieInput = document.getElementById("movieInput");
const typeFilter = document.getElementById("typeFilter");
const yearFilter = document.getElementById("yearFilter");
const searchButton = document.getElementById("searchButton");
const clearButton = document.getElementById("clearButton");
const message = document.getElementById("message");
const searchResults = document.getElementById("searchResults");
const movieResult = document.getElementById("movieResult");
const recentSearches = document.getElementById("recentSearches");
const quickButtons = document.querySelectorAll(".quick-button");

const LAST_SEARCH_KEY = "lastSearch";
const MOVIE_CACHE_KEY = "movieCache";
const RECENT_SEARCHES_KEY = "recentSearches";

let currentSearch = {
  query: "",
  type: "",
  year: "",
  page: 1,
  totalResults: 0,
  results: []
};

searchButton.addEventListener("click", searchMovie);
clearButton.addEventListener("click", clearSearch);

movieInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    searchMovie();
  }
});

quickButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    movieInput.value = button.dataset.title;
    typeFilter.value = "";
    yearFilter.value = "";
    searchMovie();
  });
});

searchResults.addEventListener("click", function (event) {
  if (event.target.classList.contains("details-button")) {
    const imdbID = event.target.dataset.imdbid;
    fetchMovieDetails(imdbID);
  }

  if (event.target.classList.contains("load-more-button")) {
    loadMoreResults();
  }
});

window.addEventListener("load", function () {
  loadLastSearch();
  renderRecentSearches();
});

async function searchMovie() {
  const movieName = movieInput.value.trim();
  const selectedType = typeFilter.value;
  const selectedYear = yearFilter.value.trim();

  if (movieName === "") {
    showMessage("Please enter a movie name.", "error");
    searchResults.style.display = "none";
    movieResult.style.display = "none";
    return;
  }

  if (selectedYear !== "" && (selectedYear < 1900 || selectedYear > 2030)) {
    showMessage("Please enter a valid year between 1900 and 2030.", "error");
    return;
  }

  const cacheKey = createSearchCacheKey(movieName, selectedType, selectedYear);
  const cachedSearch = getFromCache(cacheKey);

  movieResult.innerHTML = "";
  movieResult.style.display = "none";

  if (cachedSearch) {
    currentSearch = cachedSearch;
    renderSearchResults();
    saveLastSearch(null);
    saveRecentSearch(movieName);
    renderRecentSearches();
    showMessage("Loaded from saved data.", "success");
    return;
  }

  currentSearch = {
    query: movieName,
    type: selectedType,
    year: selectedYear,
    page: 1,
    totalResults: 0,
    results: []
  };

  await fetchSearchPage(1, false);
}

async function fetchSearchPage(page, append) {
  showMessage("Searching movies...", "loading");

  try {
    let apiUrl = `https://www.omdbapi.com/?apikey=${API_KEY}&s=${encodeURIComponent(currentSearch.query)}&page=${page}`;

    if (currentSearch.type !== "") {
      apiUrl += `&type=${currentSearch.type}`;
    }

    if (currentSearch.year !== "") {
      apiUrl += `&y=${currentSearch.year}`;
    }

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error("Network response was not successful.");
    }

    const data = await response.json();

    if (data.Response === "False") {
      showMessage(data.Error || "No movies found. Please try another title.", "error");
      searchResults.style.display = "none";
      movieResult.style.display = "none";
      return;
    }

    const newResults = data.Search || [];

    if (append) {
      const existingIds = currentSearch.results.map(function (movie) {
        return movie.imdbID;
      });

      const uniqueNewResults = newResults.filter(function (movie) {
        return !existingIds.includes(movie.imdbID);
      });

      currentSearch.results = currentSearch.results.concat(uniqueNewResults);
    } else {
      currentSearch.results = newResults;
    }

    currentSearch.page = page;
    currentSearch.totalResults = Number(data.totalResults) || currentSearch.results.length;

    const cacheKey = createSearchCacheKey(
      currentSearch.query,
      currentSearch.type,
      currentSearch.year
    );

    saveToCache(cacheKey, currentSearch);
    saveLastSearch(null);
    saveRecentSearch(currentSearch.query);
    renderRecentSearches();
    renderSearchResults();
    showMessage("");
  } catch (error) {
    showMessage("Something went wrong. Please check your connection and try again.", "error");
    console.error(error);
  }
}

async function loadMoreResults() {
  if (currentSearch.results.length >= currentSearch.totalResults) {
    showMessage("All results are already listed.", "success");
    return;
  }

  const nextPage = currentSearch.page + 1;
  await fetchSearchPage(nextPage, true);
}

async function fetchMovieDetails(imdbID) {
  const detailsCacheKey = `details-${imdbID}`;
  const cachedMovie = getFromCache(detailsCacheKey);

  if (cachedMovie) {
    displayMovie(cachedMovie);
    saveLastSearch(cachedMovie);
    showMessage("Movie details loaded from saved data.", "success");
    return;
  }

  showMessage("Loading movie details...", "loading");

  try {
    const response = await fetch(
      `https://www.omdbapi.com/?apikey=${API_KEY}&i=${imdbID}&plot=full`
    );

    if (!response.ok) {
      throw new Error("Network response was not successful.");
    }

    const data = await response.json();

    if (data.Response === "False") {
      showMessage(data.Error || "Movie details could not be loaded.", "error");
      return;
    }

    saveToCache(detailsCacheKey, data);
    displayMovie(data);
    saveLastSearch(data);
    showMessage("");
  } catch (error) {
    showMessage("Something went wrong while loading movie details.", "error");
    console.error(error);
  }
}

function renderSearchResults() {
  if (currentSearch.results.length === 0) {
    searchResults.style.display = "none";
    return;
  }

  searchResults.style.display = "block";

  const movieCards = currentSearch.results
    .map(function (movie) {
      const posterHtml =
        movie.Poster && movie.Poster !== "N/A"
          ? `<img src="${escapeHTML(movie.Poster)}" alt="${escapeHTML(movie.Title)} poster" class="result-poster" />`
          : `<div class="result-no-poster">No Poster Available</div>`;

      return `
        <article class="result-card">
          <div class="result-poster-area">
            ${posterHtml}
          </div>

          <div class="result-info">
            <h3>${escapeHTML(movie.Title)}</h3>
            <p><strong>Year:</strong> ${escapeHTML(movie.Year)}</p>
            <p><strong>Type:</strong> ${escapeHTML(movie.Type)}</p>

            <button class="details-button" data-imdbid="${escapeHTML(movie.imdbID)}">
              View Details
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  const hasMoreResults = currentSearch.results.length < currentSearch.totalResults;

  searchResults.innerHTML = `
    <div class="results-header">
      <h2>Search Results</h2>
      <span class="results-count">
        Showing ${currentSearch.results.length} of ${currentSearch.totalResults}
      </span>
    </div>

    <div class="results-grid">
      ${movieCards}
    </div>

    ${
      hasMoreResults
        ? `
          <div class="load-more-wrapper">
            <button class="load-more-button">Load More Results</button>
          </div>
        `
        : ""
    }
  `;
}

function displayMovie(movie) {
  movieResult.style.display = "block";

  const posterHtml =
    movie.Poster && movie.Poster !== "N/A"
      ? `<img src="${escapeHTML(movie.Poster)}" alt="${escapeHTML(movie.Title)} poster" class="movie-poster" />`
      : `<div class="no-poster">No Poster Available</div>`;

  movieResult.innerHTML = `
    <article class="movie-card">
      <div class="poster-area">
        ${posterHtml}
      </div>

      <div class="movie-info">
        <h2>${escapeHTML(movie.Title)}</h2>

        <div class="movie-meta">
          <span class="meta-pill">${escapeHTML(movie.Year)}</span>
          <span class="meta-pill">${escapeHTML(movie.Type)}</span>
          <span class="meta-pill">IMDb: ${escapeHTML(movie.imdbRating)}</span>
        </div>

        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">Genre</span>
            <span class="detail-value">${escapeHTML(movie.Genre)}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Director</span>
            <span class="detail-value">${escapeHTML(movie.Director)}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Runtime</span>
            <span class="detail-value">${escapeHTML(movie.Runtime)}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Released</span>
            <span class="detail-value">${escapeHTML(movie.Released)}</span>
          </div>
        </div>

        <div class="plot-box">
          ${escapeHTML(movie.Plot)}
        </div>
      </div>
    </article>
  `;

  movieResult.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = type;
}

function createSearchCacheKey(movieName, type, year) {
  return `search-${movieName.toLowerCase()}-${type || "any"}-${year || "any"}`;
}

function saveToCache(key, value) {
  const cache = JSON.parse(localStorage.getItem(MOVIE_CACHE_KEY)) || {};
  cache[key] = value;
  localStorage.setItem(MOVIE_CACHE_KEY, JSON.stringify(cache));
}

function getFromCache(key) {
  const cache = JSON.parse(localStorage.getItem(MOVIE_CACHE_KEY)) || {};
  return cache[key];
}

function saveLastSearch(selectedMovie) {
  const lastSearch = {
    searchState: currentSearch,
    selectedMovie: selectedMovie
  };

  localStorage.setItem(LAST_SEARCH_KEY, JSON.stringify(lastSearch));
}

function loadLastSearch() {
  const savedSearch = localStorage.getItem(LAST_SEARCH_KEY);

  if (!savedSearch) {
    return;
  }

  const lastSearch = JSON.parse(savedSearch);

  if (!lastSearch.searchState) {
    return;
  }

  currentSearch = lastSearch.searchState;

  movieInput.value = currentSearch.query;
  typeFilter.value = currentSearch.type;
  yearFilter.value = currentSearch.year;

  renderSearchResults();

  if (lastSearch.selectedMovie) {
    displayMovie(lastSearch.selectedMovie);
  }
}

function saveRecentSearch(movieName) {
  let searches = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY)) || [];

  searches = searches.filter(function (item) {
    return item.toLowerCase() !== movieName.toLowerCase();
  });

  searches.unshift(movieName);

  if (searches.length > 5) {
    searches = searches.slice(0, 5);
  }

  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
}

function renderRecentSearches() {
  const searches = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY)) || [];

  if (searches.length === 0) {
    recentSearches.innerHTML = "";
    return;
  }

  recentSearches.innerHTML = `
    <div class="recent-title">Recent searches:</div>
    ${searches
      .map(function (movieName) {
        return `
          <button class="recent-button" data-title="${escapeHTML(movieName)}">
            ${escapeHTML(movieName)}
          </button>
        `;
      })
      .join("")}
  `;

  const recentButtons = document.querySelectorAll(".recent-button");

  recentButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      movieInput.value = button.dataset.title;
      typeFilter.value = "";
      yearFilter.value = "";
      searchMovie();
    });
  });
}

function clearSearch() {
  movieInput.value = "";
  typeFilter.value = "";
  yearFilter.value = "";
  message.textContent = "";
  message.className = "";

  searchResults.innerHTML = "";
  searchResults.style.display = "none";

  movieResult.innerHTML = "";
  movieResult.style.display = "none";

  currentSearch = {
    query: "",
    type: "",
    year: "",
    page: 1,
    totalResults: 0,
    results: []
  };

  localStorage.removeItem(LAST_SEARCH_KEY);
}

function escapeHTML(value) {
  if (value === undefined || value === null || value === "") {
    return "N/A";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}