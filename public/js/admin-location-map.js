/**
 * Create a custom icon based on the location category
 * @param {string} category - The location category
 * @returns {L.Icon} - A Leaflet icon
 */
function createCategoryIcon(category) {
  // Define colors for different categories
  const colors = {
    // Tourist Attractions
    beach: "#2E86C1",
    waterfall: "#17A589",
    mountain: "#D35400",
    historical: "#884EA0",
    park: "#27AE60",
    viewpoint: "#F1C40F",
    cave: "#7D3C98",
    island: "#1ABC9C",
    
    // Government Establishments
    police: "#3498DB",
    barangay: "#2980B9",
    fire: "#E74C3C",
    hospital: "#E74C3C",
    government: "#34495E",
    
    // Commercial Establishments
    restaurant: "#F39C12",
    cafe: "#D35400",
    mall: "#8E44AD",
    market: "#F1C40F",
    hotel: "#3498DB",
    shop: "#16A085",
    
    // Other
    transportation: "#7F8C8D",
    school: "#2C3E50",
    church: "#95A5A6",
    other: "#BDC3C7",
    
    // Default
    default: "#3498DB",
  }

  // Define icons for different categories
  const icons = {
    // Tourist Attractions
    beach: "fa-umbrella-beach",
    waterfall: "fa-water",
    mountain: "fa-mountain",
    historical: "fa-landmark",
    park: "fa-tree",
    viewpoint: "fa-binoculars",
    cave: "fa-dungeon",
    island: "fa-island-tropical",
    
    // Government Establishments
    police: "fa-shield-alt",
    barangay: "fa-building",
    fire: "fa-fire-extinguisher",
    hospital: "fa-hospital",
    government: "fa-city",
    
    // Commercial Establishments
    restaurant: "fa-utensils",
    cafe: "fa-coffee",
    mall: "fa-shopping-bag",
    market: "fa-store",
    hotel: "fa-hotel",
    shop: "fa-store-alt",
    
    // Other
    transportation: "fa-bus",
    school: "fa-school",
    church: "fa-church",
    other: "fa-map-pin",
    
    // Default
    default: "fa-map-marker-alt",
  }

  const color = colors[category] || colors.default
  const iconClass = icons[category] || icons.default

  return L.divIcon({
    html: `<i class="fas ${iconClass}" style="color: ${color}; font-size: 24px;"></i>`,
    className: "custom-div-icon",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
}

/**
 * Get the icon class for a category
 * @param {string} category - The location category
 * @returns {string} - Font Awesome icon class
 */
function getCategoryIcon(category) {
  const icons = {
    // Tourist Attractions
    beach: "fa-umbrella-beach",
    waterfall: "fa-water",
    mountain: "fa-mountain",
    historical: "fa-landmark",
    park: "fa-tree",
    viewpoint: "fa-binoculars",
    cave: "fa-dungeon",
    island: "fa-island-tropical",
    
    // Government Establishments
    police: "fa-shield-alt",
    barangay: "fa-building",
    fire: "fa-fire-extinguisher",
    hospital: "fa-hospital",
    government: "fa-city",
    
    // Commercial Establishments
    restaurant: "fa-utensils",
    cafe: "fa-coffee",
    mall: "fa-shopping-bag",
    market: "fa-store",
    hotel: "fa-hotel",
    shop: "fa-store-alt",
    
    // Other
    transportation: "fa-bus",
    school: "fa-school",
    church: "fa-church",
    other: "fa-map-pin",
    
    // Default
    default: "fa-map-marker-alt",
  }

  return icons[category] || icons.default
}

/**
 * Get the color for a category
 * @param {string} category - The location category
 * @returns {string} - Hex color code
 */
function getCategoryColor(category) {
  const colors = {
    // Tourist Attractions
    beach: "#2E86C1",
    waterfall: "#17A589",
    mountain: "#D35400",
    historical: "#884EA0",
    park: "#27AE60",
    viewpoint: "#F1C40F",
    cave: "#7D3C98",
    island: "#1ABC9C",
    
    // Government Establishments
    police: "#3498DB",
    barangay: "#2980B9",
    fire: "#E74C3C",
    hospital: "#E74C3C",
    government: "#34495E",
    
    // Commercial Establishments
    restaurant: "#F39C12",
    cafe: "#D35400",
    mall: "#8E44AD",
    market: "#F1C40F",
    hotel: "#3498DB",
    shop: "#16A085",
    
    // Other
    transportation: "#7F8C8D",
    school: "#2C3E50",
    church: "#95A5A6",
    other: "#BDC3C7",
    
    // Default
    default: "#3498DB",
  }

  return colors[category] || colors.default
}

/**
 * Format a category for display
 * @param {string} category - The category
 * @returns {string} - Formatted category name
 */
function formatCategory(category) {
  const categories = {
    // Tourist Attractions
    beach: "Beach",
    waterfall: "Waterfall",
    mountain: "Mountain",
    historical: "Historical Site",
    park: "Park",
    viewpoint: "Viewpoint",
    cave: "Cave",
    island: "Island",
    
    // Government Establishments
    police: "Police Station",
    barangay: "Barangay Hall",
    fire: "Fire Station",
    hospital: "Hospital/Health Center",
    government: "Government Office",
    
    // Commercial Establishments
    restaurant: "Restaurant",
    cafe: "Coffee Shop/Cafe",
    mall: "Mall/Shopping Center",
    market: "Market",
    hotel: "Hotel/Resort",
    shop: "Shop/Store",
    
    // Other
    transportation: "Transportation Hub",
    school: "School/University",
    church: "Church/Religious Site",
    other: "Other Location",
    
    // Default
    default: "Tourist Spot",
  }

  return categories[category] || categories.default
}

/**
 * Admin Location Map Controller
 * Handles the tourist location management feature for the admin dashboard
 */

// Import Leaflet and Bootstrap
const L = window.L
const bootstrap = window.bootstrap

class AdminLocationMapController {
  constructor(mapElementId) {
    this.mapElementId = mapElementId
    this.map = null
    this.markers = []
    this.selectedLocation = null
    this.editMode = false
    this.tempMarker = null

    // Bind methods
    this.initMap = this.initMap.bind(this)
    this.loadLocations = this.loadLocations.bind(this)
    this.addLocationMarker = this.addLocationMarker.bind(this)
    this.clearMarkers = this.clearMarkers.bind(this)
    this.selectLocation = this.selectLocation.bind(this)
    this.enableAddMode = this.enableAddMode.bind(this)
    this.disableAddMode = this.disableAddMode.bind(this)
    this.saveLocation = this.saveLocation.bind(this)
    this.deleteLocation = this.deleteLocation.bind(this)
    this.showNotification = this.showNotification.bind(this)
  }

  /**
   * Initialize the map
   */
  async initMap() {
    // Create the map centered on Puerto Galera, Philippines
    this.map = L.map(this.mapElementId).setView([13.5, 120.97], 13)

    // Add the OpenStreetMap tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map)

    // Add click event for adding new locations
    this.map.on("click", (e) => {
      if (this.editMode) {
        this.handleMapClick(e)
      }
    })

    // Load existing locations
    await this.loadLocations()
  }

  /**
   * Load tourist locations from the server
   */
  async loadLocations() {
    try {
      console.log("Fetching locations from /admin/tourist-locations");
      const response = await fetch("/admin/tourist-locations");
      
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);
      
      // Clone the response to inspect its content
      const responseClone = response.clone();
      const textContent = await responseClone.text();
      console.log("Response content (first 200 chars):", textContent.substring(0, 200));

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }

      // Parse the response as JSON
      const locations = JSON.parse(textContent);
      console.log(`Loaded ${locations.length} locations`);

      // Clear existing markers
      this.clearMarkers()

      // Add markers for each location
      locations.forEach((location) => {
        this.addLocationMarker(location)
      })

      // Update the locations list in the sidebar
      this.updateLocationsList(locations)

      return locations
    } catch (error) {
      console.error("Error loading locations:", error)
      this.showNotification("Error loading tourist locations", "error")
      return []
    }
  }

  /**
   * Add a marker for a tourist location
   * @param {Object} location - The location data
   */
  addLocationMarker(location) {
    // Create a custom icon based on the location category
    const icon = this.createCategoryIcon(location.category)

    // Create the marker
    const marker = L.marker([location.latitude, location.longitude], {
      icon: icon,
      locationId: location.id,
    }).addTo(this.map)

    // Create popup content
    const popupContent = `
      <div class="location-popup">
        <h5>${location.name}</h5>
        <p class="location-category">${this.formatCategory(location.category)}</p>
        ${location.image ? `<img src="/uploads/locations/${location.image}" alt="${location.name}" class="location-thumbnail">` : ""}
        <p class="location-description">${location.description.substring(0, 100)}${location.description.length > 100 ? "..." : ""}</p>
        <button class="btn btn-sm btn-primary view-details-btn" data-id="${location.id}">
          View Details
        </button>
      </div>
    `

    marker.bindPopup(popupContent)

    // Add event listener to the popup
    marker.on("popupopen", () => {
      // Find the View Details button in the popup
      const detailsBtn = document.querySelector(`.view-details-btn[data-id="${location.id}"]`)

      if (detailsBtn) {
        // Add click event listener to the button
        detailsBtn.addEventListener("click", () => {
          this.selectLocation(location.id)
        })
      }
    })

    // Store the marker
    this.markers.push({
      id: location.id,
      marker: marker,
      data: location,
    })
  }

  /**
   * Create a custom icon based on the location category
   * @param {string} category - The location category
   * @returns {L.Icon} - A Leaflet icon
   */
  createCategoryIcon(category) {
    // Define colors for different categories
    const colors = {
      // Tourist Attractions
      beach: "#2E86C1",
      waterfall: "#17A589",
      mountain: "#D35400",
      historical: "#884EA0",
      park: "#27AE60",
      viewpoint: "#F1C40F",
      cave: "#7D3C98",
      island: "#1ABC9C",
      
      // Government Establishments
      police: "#3498DB",
      barangay: "#2980B9",
      fire: "#E74C3C",
      hospital: "#E74C3C",
      government: "#34495E",
      
      // Commercial Establishments
      restaurant: "#F39C12",
      cafe: "#D35400",
      mall: "#8E44AD",
      market: "#F1C40F",
      hotel: "#3498DB",
      shop: "#16A085",
      
      // Other
      transportation: "#7F8C8D",
      school: "#2C3E50",
      church: "#95A5A6",
      other: "#BDC3C7",
      
      // Default
      default: "#3498DB",
    }

    // Define icons for different categories
    const icons = {
      // Tourist Attractions
      beach: "fa-umbrella-beach",
      waterfall: "fa-water",
      mountain: "fa-mountain",
      historical: "fa-landmark",
      park: "fa-tree",
      viewpoint: "fa-binoculars",
      cave: "fa-dungeon",
      island: "fa-island-tropical",
      
      // Government Establishments
      police: "fa-shield-alt",
      barangay: "fa-building",
      fire: "fa-fire-extinguisher",
      hospital: "fa-hospital",
      government: "fa-city",
      
      // Commercial Establishments
      restaurant: "fa-utensils",
      cafe: "fa-coffee",
      mall: "fa-shopping-bag",
      market: "fa-store",
      hotel: "fa-hotel",
      shop: "fa-store-alt",
      
      // Other
      transportation: "fa-bus",
      school: "fa-school",
      church: "fa-church",
      other: "fa-map-pin",
      
      // Default
      default: "fa-map-marker-alt",
    }

    const color = colors[category] || colors.default
    const iconClass = icons[category] || icons.default

    return L.divIcon({
      html: `<i class="fas ${iconClass}" style="color: ${color}; font-size: 24px;"></i>`,
      className: "custom-div-icon",
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30],
    })
  }

  /**
   * Clear all markers from the map
   */
  clearMarkers() {
    this.markers.forEach((item) => {
      this.map.removeLayer(item.marker)
    })

    this.markers = []
  }

  /**
   * Select a location and show its details
   * @param {number} locationId - The ID of the location to select
   */
  async selectLocation(locationId) {
    try {
      // Fetch detailed information about the location
      const response = await fetch(`/admin/tourist-locations/${locationId}`)

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }

      const location = await response.json()
      this.selectedLocation = location

      // Find the marker for this location
      const markerItem = this.markers.find((item) => item.id === locationId)

      if (markerItem) {
        // Center the map on the selected location
        this.map.setView([location.latitude, location.longitude], 15)

        // Open the popup
        markerItem.marker.openPopup()
      }

      // Show the location details panel
      this.showLocationDetails(location)
    } catch (error) {
      console.error("Error selecting location:", error)
      this.showNotification("Error loading location details", "error")
    }
  }

  /**
   * Show the location details in the details panel
   * @param {Object} location - The location data
   */
  showLocationDetails(location) {
    const detailsPanel = document.getElementById("location-details")

    if (!detailsPanel) {
      return
    }

    // Format the details HTML
    detailsPanel.innerHTML = `
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5 class="mb-0">${location.name}</h5>
          <div>
            <button type="button" class="btn btn-sm btn-primary edit-location-btn">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button type="button" class="btn btn-sm btn-danger delete-location-btn">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="location-image-container mb-3">
            ${
              location.image
                ? `<img src="/uploads/locations/${location.image}" alt="${location.name}" class="img-fluid rounded">`
                : `<div class="no-image">No image available</div>`
            }
          </div>
          
          <div class="location-info">
            <p class="location-category badge bg-primary">${this.formatCategory(location.category)}</p>
            <p class="location-description">${location.description}</p>
            
            <div class="location-details mt-4">
              <div class="detail-item">
                <i class="fas fa-map-marker-alt"></i>
                <span>${location.address}</span>
              </div>
              
              ${
                location.opening_hours
                  ? `
                <div class="detail-item">
                  <i class="fas fa-clock"></i>
                  <span>${location.opening_hours}</span>
                </div>
              `
                  : ""
              }
              
              ${
                location.contact_info
                  ? `
                <div class="detail-item">
                  <i class="fas fa-phone"></i>
                  <span>${location.contact_info}</span>
                </div>
              `
                  : ""
              }
              
              ${
                location.website
                  ? `
                <div class="detail-item">
                  <i class="fas fa-globe"></i>
                  <a href="${location.website}" target="_blank">${location.website}</a>
                </div>
              `
                  : ""
              }
              
              ${
                location.entrance_fee
                  ? `
                <div class="detail-item">
                  <i class="fas fa-ticket-alt"></i>
                  <span>Entrance Fee: ${location.entrance_fee}</span>
                </div>
              `
                  : ""
              }
              
              ${
                location.rating
                  ? `
                <div class="detail-item">
                  <i class="fas fa-star"></i>
                  <span>Rating: ${location.rating} / 5</span>
                </div>
              `
                  : ""
              }
            </div>
          </div>
        </div>
      </div>
    `

    // Show the details panel
    detailsPanel.style.display = "block"

    // Add event listeners to the buttons
    const editBtn = detailsPanel.querySelector(".edit-location-btn")
    const deleteBtn = detailsPanel.querySelector(".delete-location-btn")

    if (editBtn) {
      editBtn.addEventListener("click", () => {
        this.showEditForm(location)
      })
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        if (confirm(`Are you sure you want to delete "${location.name}"?`)) {
          this.deleteLocation(location.id)
        }
      })
    }
  }

  /**
   * Show the edit form for a location
   * @param {Object} location - The location data to edit
   */
  showEditForm(location) {
    // Populate the form with location data
    const form = document.getElementById("location-form")

    if (!form) {
      return
    }

    document.getElementById("location-id").value = location.id
    document.getElementById("location-name").value = location.name
    document.getElementById("location-description").value = location.description
    document.getElementById("location-latitude").value = location.latitude
    document.getElementById("location-longitude").value = location.longitude
    document.getElementById("location-address").value = location.address
    document.getElementById("location-category").value = location.category
    document.getElementById("location-opening-hours").value = location.opening_hours || ""
    document.getElementById("location-contact").value = location.contact_info || ""
    document.getElementById("location-website").value = location.website || ""
    document.getElementById("location-fee").value = location.entrance_fee || ""
    document.getElementById("location-rating").value = location.rating || ""

    // Show the current image if it exists
    const currentImageContainer = document.getElementById("current-image-container")
    if (currentImageContainer) {
      if (location.image) {
        currentImageContainer.innerHTML = `
          <div class="mb-2">Current Image:</div>
          <img src="/uploads/locations/${location.image}" alt="${location.name}" class="img-thumbnail" style="max-height: 150px;">
        `
        currentImageContainer.style.display = "block"
      } else {
        currentImageContainer.style.display = "none"
      }
    }

    // Update form title and submit button
    document.getElementById("form-title").textContent = "Edit Tourist Location"
    document.getElementById("submit-location").textContent = "Update Location"

    // Show the form modal
    const locationModal = new bootstrap.Modal(document.getElementById("location-modal"))
    locationModal.show()
  }

  /**
   * Enable add mode for placing a new location on the map
   */
  enableAddMode() {
    this.editMode = true
    this.map.getContainer().style.cursor = "crosshair"

    // Show instructions
    this.showNotification("Click on the map to place the new location", "info")

    // Update the add button
    const addBtn = document.getElementById("add-location-btn")
    if (addBtn) {
      addBtn.textContent = "Cancel"
      addBtn.classList.remove("btn-primary")
      addBtn.classList.add("btn-secondary")
    }
  }

  /**
   * Disable add mode
   */
  disableAddMode() {
    this.editMode = false
    this.map.getContainer().style.cursor = ""

    // Remove temporary marker if it exists
    if (this.tempMarker) {
      this.map.removeLayer(this.tempMarker)
      this.tempMarker = null
    }

    // Update the add button
    const addBtn = document.getElementById("add-location-btn")
    if (addBtn) {
      addBtn.textContent = "Add New Location"
      addBtn.classList.remove("btn-secondary")
      addBtn.classList.add("btn-primary")
    }
  }

  /**
   * Handle map click when in add mode
   * @param {L.MouseEvent} e - The click event
   */
  handleMapClick(e) {
    // Remove previous temporary marker if it exists
    if (this.tempMarker) {
      this.map.removeLayer(this.tempMarker)
    }

    // Create a temporary marker at the clicked location
    this.tempMarker = L.marker(e.latlng, {
      icon: L.divIcon({
        html: '<i class="fas fa-map-marker-alt" style="color: #dc3545; font-size: 24px;"></i>',
        className: "custom-div-icon",
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      }),
      draggable: true,
    }).addTo(this.map)

    // Show the add location form
    this.showAddForm(e.latlng.lat, e.latlng.lng)

    // Disable add mode
    this.disableAddMode()
  }

  /**
   * Show the add form for a new location
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   */
  showAddForm(lat, lng) {
    // Reset the form
    const form = document.getElementById("location-form")

    if (!form) {
      return
    }

    form.reset()

    // Set the coordinates
    document.getElementById("location-id").value = ""
    document.getElementById("location-latitude").value = lat.toFixed(8)
    document.getElementById("location-longitude").value = lng.toFixed(8)

    // Hide current image container
    const currentImageContainer = document.getElementById("current-image-container")
    if (currentImageContainer) {
      currentImageContainer.style.display = "none"
    }

    // Update form title and submit button
    document.getElementById("form-title").textContent = "Add New Tourist Location"
    document.getElementById("submit-location").textContent = "Add Location"

    // Show the form modal
    const locationModal = new bootstrap.Modal(document.getElementById("location-modal"))
    locationModal.show()
  }

  /**
   * Save a location (create or update)
   * @param {FormData} formData - The form data
   */
  async saveLocation(formData) {
    try {
      const locationId = formData.get("id")
      const isNewLocation = !locationId

      // Determine the URL and method based on whether this is a new location or an update
      const url = isNewLocation ? "/admin/tourist-locations" : `/admin/tourist-locations/${locationId}`

      const method = isNewLocation ? "POST" : "PUT"

      // Send the request
      const response = await fetch(url, {
        method: method,
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`)
      }

      // Reload the locations
      await this.loadLocations()

      // Show success message
      this.showNotification(
        isNewLocation ? "Tourist location added successfully" : "Tourist location updated successfully",
        "success",
      )

      // Hide the form modal
      const locationModal = bootstrap.Modal.getInstance(document.getElementById("location-modal"))
      if (locationModal) {
        locationModal.hide()
      }

      // If this was a new location, clear the temporary marker
      if (isNewLocation && this.tempMarker) {
        this.map.removeLayer(this.tempMarker)
        this.tempMarker = null
      }

      // Hide the details panel
      const detailsPanel = document.getElementById("location-details")
      if (detailsPanel) {
        detailsPanel.style.display = "none"
      }
    } catch (error) {
      console.error("Error saving location:", error)
      this.showNotification(`Error saving location: ${error.message}`, "error")
    }
  }

  /**
   * Delete a location
   * @param {number} locationId - The ID of the location to delete
   */
  async deleteLocation(locationId) {
    try {
      const response = await fetch(`/admin/tourist-locations/${locationId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`)
      }

      // Reload the locations
      await this.loadLocations()

      // Show success message
      this.showNotification("Tourist location deleted successfully", "success")

      // Hide the details panel
      const detailsPanel = document.getElementById("location-details")
      if (detailsPanel) {
        detailsPanel.style.display = "none"
      }
    } catch (error) {
      console.error("Error deleting location:", error)
      this.showNotification(`Error deleting location: ${error.message}`, "error")
    }
  }

  /**
   * Update the locations list in the sidebar
   * @param {Array} locations - Array of location objects
   */
  updateLocationsList(locations) {
    const listElement = document.getElementById("locations-list")

    if (!listElement) {
      return
    }

    if (locations.length === 0) {
      listElement.innerHTML = '<p class="text-muted">No tourist locations found</p>'
      return
    }

    // Sort locations alphabetically by name
    const sortedLocations = [...locations].sort((a, b) => {
      return a.name.localeCompare(b.name)
    })

    // Generate HTML for the list
    listElement.innerHTML = sortedLocations
      .map(
        (location) => `
      <div class="location-item" data-id="${location.id}">
        <div class="location-icon">
          <i class="fas ${this.getCategoryIcon(location.category)}" style="color: ${this.getCategoryColor(location.category)};"></i>
        </div>
        <div class="location-details">
          <h6>${location.name}</h6>
          <p class="text-muted">${this.formatCategory(location.category)}</p>
        </div>
      </div>
    `,
      )
      .join("")

    // Add event listeners to list items
    const listItems = listElement.querySelectorAll(".location-item")
    listItems.forEach((item) => {
      item.addEventListener("click", () => {
        const id = Number.parseInt(item.getAttribute("data-id"), 10)
        this.selectLocation(id)
      })
    })
  }

  /**
   * Get the icon class for a category
   * @param {string} category - The location category
   * @returns {string} - Font Awesome icon class
   */
  getCategoryIcon(category) {
    const icons = {
      // Tourist Attractions
      beach: "fa-umbrella-beach",
      waterfall: "fa-water",
      mountain: "fa-mountain",
      historical: "fa-landmark",
      park: "fa-tree",
      viewpoint: "fa-binoculars",
      cave: "fa-dungeon",
      island: "fa-island-tropical",
      
      // Government Establishments
      police: "fa-shield-alt",
      barangay: "fa-building",
      fire: "fa-fire-extinguisher",
      hospital: "fa-hospital",
      government: "fa-city",
      
      // Commercial Establishments
      restaurant: "fa-utensils",
      cafe: "fa-coffee",
      mall: "fa-shopping-bag",
      market: "fa-store",
      hotel: "fa-hotel",
      shop: "fa-store-alt",
      
      // Other
      transportation: "fa-bus",
      school: "fa-school",
      church: "fa-church",
      other: "fa-map-pin",
      
      // Default
      default: "fa-map-marker-alt",
    }

    return icons[category] || icons.default
  }

  /**
   * Get the color for a category
   * @param {string} category - The location category
   * @returns {string} - Hex color code
   */
  getCategoryColor(category) {
    const colors = {
      // Tourist Attractions
      beach: "#2E86C1",
      waterfall: "#17A589",
      mountain: "#D35400",
      historical: "#884EA0",
      park: "#27AE60",
      viewpoint: "#F1C40F",
      cave: "#7D3C98",
      island: "#1ABC9C",
      
      // Government Establishments
      police: "#3498DB",
      barangay: "#2980B9",
      fire: "#E74C3C",
      hospital: "#E74C3C",
      government: "#34495E",
      
      // Commercial Establishments
      restaurant: "#F39C12",
      cafe: "#D35400",
      mall: "#8E44AD",
      market: "#F1C40F",
      hotel: "#3498DB",
      shop: "#16A085",
      
      // Other
      transportation: "#7F8C8D",
      school: "#2C3E50",
      church: "#95A5A6",
      other: "#BDC3C7",
      
      // Default
      default: "#3498DB",
    }

    return colors[category] || colors.default
  }

  /**
   * Format a category for display
   * @param {string} category - The category
   * @returns {string} - Formatted category name
   */
  formatCategory(category) {
    const categories = {
      // Tourist Attractions
      beach: "Beach",
      waterfall: "Waterfall",
      mountain: "Mountain",
      historical: "Historical Site",
      park: "Park",
      viewpoint: "Viewpoint",
      cave: "Cave",
      island: "Island",
      
      // Government Establishments
      police: "Police Station",
      barangay: "Barangay Hall",
      fire: "Fire Station",
      hospital: "Hospital/Health Center",
      government: "Government Office",
      
      // Commercial Establishments
      restaurant: "Restaurant",
      cafe: "Coffee Shop/Cafe",
      mall: "Mall/Shopping Center",
      market: "Market",
      hotel: "Hotel/Resort",
      shop: "Shop/Store",
      
      // Other
      transportation: "Transportation Hub",
      school: "School/University",
      church: "Church/Religious Site",
      other: "Other Location",
      
      // Default
      default: "Tourist Spot",
    }

    return categories[category] || categories.default
  }

  /**
   * Show a notification
   * @param {string} message - The notification message
   * @param {string} type - The notification type (success, error, warning, info)
   */
  showNotification(message, type = "success") {
    // Check if the notification element exists
    let notificationElement = document.getElementById("map-notification")

    if (!notificationElement) {
      // Create the notification element
      notificationElement = document.createElement("div")
      notificationElement.id = "map-notification"
      notificationElement.className = "map-notification"
      document.body.appendChild(notificationElement)
    }

    // Set the notification content
    notificationElement.innerHTML = `
      <div class="notification-${type}">
        <i class="fas ${
          type === "success"
            ? "fa-check-circle"
            : type === "error"
              ? "fa-exclamation-circle"
              : type === "warning"
                ? "fa-exclamation-triangle"
                : "fa-info-circle"
        }"></i>
        <span>${message}</span>
      </div>
    `

    // Show the notification
    notificationElement.classList.add("show")

    // Hide the notification after 3 seconds
    setTimeout(() => {
      notificationElement.classList.remove("show")
    }, 3000)
  }
}

// Make the controller available globally
window.AdminLocationMapController = AdminLocationMapController