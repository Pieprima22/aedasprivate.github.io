// Import Three.js
import * as THREE from "https://cdn.skypack.dev/three@0.136.0";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls";


// Get modal elements
var projectDetailModal = document.getElementById("projectDetailModal");
var projectIcon = document.getElementById("projectIcon");
var projectTitle = document.getElementById("projectTitle");
var projectLocation = document.getElementById("projectLocation");
var projectDate = document.getElementById("projectDate");
var projectClient = document.getElementById("projectClient");
var projectTypology = document.getElementById("projectTypology");
var projectImage = document.getElementById("projectImage");

// Get link elements in the modal
var presentationLink = document.getElementById("presentationLink");
var visualsLink = document.getElementById("visualsLink");
var animationLink = document.getElementById("animationLink");
var drawingsLink = document.getElementById("drawingsLink");
var threeDModelLink = document.getElementById("3DModelLink");
var homePageLink = document.getElementById("homePageLink");
// Function to update project links
function updateProjectLinks(projectBox) {
    // Get project links container
    const projectLinksContainer = document.querySelector('.project-links');
    if (!projectLinksContainer) return;

    // Clear existing links
    projectLinksContainer.innerHTML = '';

    // Create containers for home link and other links
    const homeLinkContainer = document.createElement('div');
    homeLinkContainer.className = 'home-link';
    const otherLinksContainer = document.createElement('div');
    otherLinksContainer.className = 'other-links';

    // Define the links array dynamically from the current project box
    const links = [
        { url: "javascript:void(0)", icon: "images.png", action: "close", isHome: true },
        { url: projectBox.getAttribute('data-3dmodel-link'), icon: projectBox.getAttribute('data-3dmodel-icon') || 'default-3dmodel-icon.png', isHome: false },
        { url: projectBox.getAttribute('data-drawings-link'), icon: projectBox.getAttribute('data-drawings-icon') || 'default-drawings-icon.png', isHome: false },
        { url: projectBox.getAttribute('data-animation-link'), icon: projectBox.getAttribute('data-animation-icon') || 'default-animation-icon.png', isHome: false },
        { url: projectBox.getAttribute('data-visuals-link'), icon: projectBox.getAttribute('data-visuals-icon') || 'default-visuals-icon.png', isHome: false },
        { url: projectBox.getAttribute('data-presentation-link'), icon: projectBox.getAttribute('data-presentation-icon') || 'default-presentation-icon.png', isHome: false }
    ];

    // Create and append links
    links.forEach(({ url, icon, action, isHome }) => {
        if (url || action === "close") {
            const linkElement = document.createElement('a');
            linkElement.href = url || 'javascript:void(0)';
            linkElement.target = action === "close" ? "" : "_blank";

            if (isHome) {
                linkElement.textContent = 'HOME';
                linkElement.onclick = closeProjectDetail;
                linkElement.classList.add('home-link');
                homeLinkContainer.appendChild(linkElement);
            } else {
                if (url) {
                    linkElement.innerHTML = `<img src="${icon}" alt="Link Icon">`;
                    otherLinksContainer.appendChild(linkElement);
                }
            }
        }
    });

    // Append containers
    projectLinksContainer.appendChild(homeLinkContainer);
    projectLinksContainer.appendChild(otherLinksContainer);
    projectLinksContainer.style.display = projectLinksContainer.childElementCount > 0 ? 'flex' : 'none';
}

document.querySelectorAll('.project-box').forEach((box) => {
    box.addEventListener('click', function () {
        // Retrieve project-specific data
        const title = this.getAttribute('data-title');
        const location = this.getAttribute('data-location');
        const date = this.getAttribute('data-date');
        const client = this.getAttribute('data-client');
        const typology = this.getAttribute('data-typology');


        // Set the basic project information
        projectTitle.textContent = title || 'Untitled Project';
        projectLocation.textContent = location || 'Unknown Location';
        projectDate.textContent = date || 'No Date Provided';
        projectClient.textContent = client || 'No Client Specified';
        projectTypology.textContent = typology || 'Unknown Typology';

        // Set the project icon and main image
        projectIcon.src = this.getAttribute('data-icon') || 'default-icon.png';
        projectImage.src = this.querySelector('.hover-image')?.src || 'default-image.png';

// MODIFICATION: Ensure links are correctly set for ALL project types
        const projectLinksContainer = document.querySelector('.project-links');
        projectLinksContainer.innerHTML = ''; // Clear any previous links

        const homeLinkContainer = document.createElement('div');
        homeLinkContainer.className = 'home-link';
        const otherLinksContainer = document.createElement('div');
        otherLinksContainer.className = 'other-links';

        // Define the links array dynamically from the current project box
        const links = [
            { url: "javascript:void(0)", icon: "images.png", action: "close", isHome: true }, // Homepage
            { url: this.getAttribute('data-3dmodel-link'), icon: this.getAttribute('data-3dmodel-icon') || 'default-3dmodel-icon.png', isHome: false }, // 3D Model
            { url: this.getAttribute('data-drawings-link'), icon: this.getAttribute('data-drawings-icon') || 'default-drawings-icon.png', isHome: false }, // Drawings
            { url: this.getAttribute('data-animation-link'), icon: this.getAttribute('data-animation-icon') || 'default-animation-icon.png', isHome: false }, // Animation
            { url: this.getAttribute('data-visuals-link'), icon: this.getAttribute('data-visuals-icon') || 'default-visuals-icon.png', isHome: false }, // Visuals
            { url: this.getAttribute('data-presentation-link'), icon: this.getAttribute('data-presentation-icon') || 'default-presentation-icon.png', isHome: false } // Presentation
        ];

        // UPDATED: Ensure links are filtered and added correctly
        links.forEach(({ url, icon, action, isHome }) => {
            if (url || action === "close") {
                const linkElement = document.createElement('a');
                linkElement.href = url || 'javascript:void(0)';
                linkElement.target = action === "close" ? "" : "_blank";

                if (isHome) {
                    linkElement.textContent = 'HOME';
                    linkElement.onclick = closeProjectDetail;
                    linkElement.classList.add('home-link');
                    homeLinkContainer.appendChild(linkElement);
                } else {
                    // Ensure the icon is added only if a URL exists
                    if (url) {
                        linkElement.innerHTML = `<img src="${icon}" alt="Link Icon">`;
                        otherLinksContainer.appendChild(linkElement);
                    }
                }
            }
        });

        // Append containers and handle display
        projectLinksContainer.appendChild(homeLinkContainer);
        projectLinksContainer.appendChild(otherLinksContainer);
        projectLinksContainer.style.display = projectLinksContainer.childElementCount > 0 ? 'flex' : 'none';


        // Load gallery images
        const imageGallery = document.getElementById('imageGallery');
        imageGallery.innerHTML = ''; // Clear previous images
        const images = JSON.parse(this.getAttribute('data-images') || '[]');
        images.forEach(imageUrl => {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = "Project Image";
            imageGallery.appendChild(img);
        });

       // Get the team member data
       const team = JSON.parse(this.getAttribute('data-team') || '[]');
        
       // Create a single string with all team members separated by commas
       const teamMemberNames = team.join(', ');

       // Set the content of the paragraph
       const teamMemberParagraph = document.getElementById('teamMemberNames');
       teamMemberParagraph.textContent = teamMemberNames;

       // Show or hide the team section based on whether there are team members

        // Retrieve project-specific data for new-page-content
        const projectNewImage = this.getAttribute('data-new-image') || 'default-image.png';
        const paragraph1 = this.getAttribute('data-paragraph1') || 'Default project description.';
        const paragraph2 = this.getAttribute('data-paragraph2') || 'Default project description.';
        const paragraph3 = this.getAttribute('data-paragraph3') || 'Default project description.';


        const projectNewText = this.getAttribute('data-new-text') || 'Default project description.';

        // Update the new-page-content section
        const newPageContent = document.querySelector('.new-page-content');
        const newPageImage = newPageContent.querySelector('.new-page-image');
        const newPageText = newPageContent.querySelector('.text-container');

        // Set the new image and new text
        newPageImage.src = projectNewImage;
        newPageText.textContent = projectNewText;
        // Dynamically create and insert the paragraphs
        newPageText.innerHTML = `
                <p>${paragraph1}</p>
                <p>${paragraph2}</p>
                <p>${paragraph3}</p>
                `;
        // Display the modal
        projectDetailModal.style.display = "block";
    });
    
});

window.closeProjectDetail = function() {
    const projectDetailModal = document.getElementById("projectDetailModal");
    if (projectDetailModal) {
        // Reset the scroll position to the top
        projectDetailModal.scrollTop = 0;
        projectDetailModal.style.display = "none";
    } else {
        console.error("Project Detail Modal not found.");
    }
};


function addClickEventToProjectBox(projectBox) {
    projectBox.addEventListener('click', function () {
        // Retrieve project-specific data
        const title = this.getAttribute('data-title') || 'Untitled Project';
        const location = this.getAttribute('data-location') || 'Unknown Location';
        const date = this.getAttribute('data-date') || 'No Date Provided';
        const client = this.getAttribute('data-client') || 'No Client Specified';
        const typology = this.getAttribute('data-typology') || 'Unknown Typology';
        
        // Set Project Title and Details
        document.getElementById('projectTitle').textContent = title;
        document.getElementById('projectLocation').textContent = location;
        document.getElementById('projectDate').textContent = date;
        document.getElementById('projectClient').textContent = client;
        document.getElementById('projectTypology').textContent = typology;

        // Project Icon
        const projectSymbol = document.getElementById('projectIcon');
        const iconURL = this.getAttribute('data-icon') || 'default-icon.png';
        if (projectSymbol) {
            projectSymbol.src = iconURL;
            projectSymbol.style.display = 'block';
        }

        // Project Image in Description
        const hoverImage = this.querySelector('.hover-image');
        const projectImageSection = document.getElementById('projectImage');
        if (hoverImage && projectImageSection) {
            projectImageSection.src = hoverImage.src;
            projectImageSection.style.display = 'block';
        }

        // New Page Image
        const newImage = this.getAttribute('data-new-image') || 'default-new-image.png';
        const newPageImage = document.querySelector('.new-page-image');
        if (newPageImage) {
            newPageImage.src = newImage;
            newPageImage.style.display = 'block';
        }

        // New Page Text
        const paragraph1 = this.getAttribute('data-paragraph1') || '';
        const paragraph2 = this.getAttribute('data-paragraph2') || '';
        const paragraph3 = this.getAttribute('data-paragraph3') || '';
        const newPageText = document.querySelector('.text-container');
        if (newPageText) {
            newPageText.innerHTML = `
                <p>${paragraph1}</p>
                <p>${paragraph2}</p>
                <p>${paragraph3}</p>
            `;
        }

        // Team Names
        const teamData = JSON.parse(this.getAttribute('data-team') || '[]');
        const teamSection = document.getElementById('teamMemberNames');
        if (teamSection) {
            teamSection.textContent = teamData.length
                ? teamData.join(', ')
                : 'No team members available.';
        }

        // Update Project Links
        const projectLinksContainer = document.querySelector('.project-links');
        if (projectLinksContainer) {
            // Clear existing links
            projectLinksContainer.innerHTML = '';

            // Create containers
            const homeLinkContainer = document.createElement('div');
            homeLinkContainer.className = 'home-link';
            const otherLinksContainer = document.createElement('div');
            otherLinksContainer.className = 'other-links';

            // Define links configuration
            const links = [
                { url: "javascript:void(0)", icon: "images.png", action: "close", isHome: true },
                { url: this.getAttribute('data-3dmodel-link'), icon: this.getAttribute('data-3dmodel-icon'), type: "3D Model" },
                { url: this.getAttribute('data-drawings-link'), icon: this.getAttribute('data-drawings-icon'), type: "Drawings" },
                { url: this.getAttribute('data-animation-link'), icon: this.getAttribute('data-animation-icon'), type: "Animation" },
                { url: this.getAttribute('data-visuals-link'), icon: this.getAttribute('data-visuals-icon'), type: "Visuals" },
                { url: this.getAttribute('data-presentation-link'), icon: this.getAttribute('data-presentation-icon'), type: "Presentation" }
            ];

            // Create and append links
            links.forEach(({ url, icon, action, isHome, type }) => {
                if (url || action === "close") {
                    const linkElement = document.createElement('a');
                    linkElement.href = url || 'javascript:void(0)';
                    linkElement.target = action === "close" ? "" : "_blank";

                    if (isHome) {
                        linkElement.textContent = 'HOME';
                        linkElement.onclick = closeProjectDetail;
                        linkElement.classList.add('home-link');
                        homeLinkContainer.appendChild(linkElement);
                    } else if (url) {
                        linkElement.innerHTML = `<img src="${icon || `default-${type.toLowerCase()}-icon.png`}" alt="${type} Icon">`;
                        otherLinksContainer.appendChild(linkElement);
                    }
                }
            });

            // Append containers
            projectLinksContainer.appendChild(homeLinkContainer);
            projectLinksContainer.appendChild(otherLinksContainer);
        }

        // Load gallery images
        const imageGallery = document.getElementById('imageGallery');
        imageGallery.innerHTML = '';
        const images = JSON.parse(this.getAttribute('data-images') || '[]');
        images.forEach(imageUrl => {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = "Project Image";
            imageGallery.appendChild(img);
        });

        // Show the modal
        const projectDetailModal = document.getElementById('projectDetailModal');
        if (projectDetailModal) {
            projectDetailModal.style.display = "block";
        }
    });
}


function sortProjects(criteria) {
    const gallery = document.querySelector('.symbol-grid');
    const yearColumns = Array.from(gallery.getElementsByClassName('year-column'));
    const epochHeader = document.getElementById('epochTimeline'); // Add epoch header reference
    const timelineHeader = document.querySelector('.timeline-header');
    const alphabeticalHeader = document.querySelector('.alphabetical-header');
    const programmaticHeader = document.querySelector('.programmatic-header');
    const scaleHeader = document.querySelector('.scale-header'); // Added scale header reference
    const globeContainerId = 'globe-container';

        // Enhanced clearDynamicElements function
        function clearDynamicElements() {
            // Remove all project markers
            document.querySelectorAll('.project-globe-marker').forEach(marker => marker.remove());
            
            // Remove existing globe container
            const existingGlobeContainer = document.getElementById('globe-container');
            if (existingGlobeContainer) {
                existingGlobeContainer.remove();
            }

            // Clear the locations array
            if (window.locations) {
                window.locations.forEach(location => {
                    location.projects = []; // Reset projects array for each location
                });
            }
        }
            
    if (criteria === 'alphabetical') {
        // Hide the timeline header and show the alphabetical header
        timelineHeader.style.display = 'none';
        alphabeticalHeader.style.display = 'grid';
        programmaticHeader.style.display = 'none';
        scaleHeader.style.display = 'none';
        epochHeader.style.display = 'none';  // Hide epoch
        // Hide or remove the globe container
        const globeContainer = document.getElementById('globe-container');
        if (globeContainer) {
            globeContainer.style.display = 'none'; // Hide the globe
        }


        // Hide the year columns but keep them in the DOM for later restoration
        yearColumns.forEach(yearColumn => yearColumn.style.display = 'none');

        // Clear previous content in each alphabetical section
        alphabeticalHeader.querySelectorAll('.alphabet-label').forEach(label => {
            label.innerHTML = label.getAttribute('data-letter'); // Reset to just the letter
        });

        // Collect and sort all project boxes by alphabetical order of the symbol name
        let projectBoxes = [];
        yearColumns.forEach(yearColumn => {
            yearColumn.querySelectorAll('.project-box').forEach(projectBox => {
                const clonedProject = projectBox.cloneNode(true);
                projectBoxes.push(clonedProject); // Clone each project box for alphabetical
                addClickEventToProjectBox(clonedProject); // Attach click event to each cloned project box
            });
        });

        // Sort project boxes alphabetically by symbol name
        projectBoxes.sort((a, b) => {
            const nameA = a.querySelector('.symbol-name')?.textContent.trim().toUpperCase();
            const nameB = b.querySelector('.symbol-name')?.textContent.trim().toUpperCase();
            return nameA.localeCompare(nameB);
        });
        projectBoxes.forEach(projectBox => {
            const firstLetter = projectBox.querySelector('.symbol-name')?.textContent.trim().charAt(0).toUpperCase();
            const alphabetSection = alphabeticalHeader.querySelector(`.alphabet-label[data-letter="${firstLetter}"]`);
            if (alphabetSection) {
                const clonedProject = projectBox.cloneNode(true);
        
                // Copy all data attributes explicitly
                Array.from(projectBox.attributes).forEach(attr => {
                    clonedProject.setAttribute(attr.name, attr.value);
                });
        
                addClickEventToProjectBox(clonedProject); // Attach click event
                alphabetSection.appendChild(clonedProject);
            }
        });

        reattachTooltipEvents(); // Ensure tooltips and other events are correctly reattached

    } else if (criteria === 'location') {
        // Clear everything first
        clearDynamicElements();

        // Step 2: Hide other views
        timelineHeader.style.display = 'none';
        alphabeticalHeader.style.display = 'none';
        scaleHeader.style.display = 'none';
        epochHeader.style.display = 'none';
        programmaticHeader.style.display = 'none';
        yearColumns.forEach(yearColumn => yearColumn.style.display = 'none');
    
          // Step 3: Remove existing globe container
        let existingGlobeContainer = document.getElementById('globe-container');
        if (existingGlobeContainer) {
            existingGlobeContainer.remove();
        }
        // Step 4: Create a new globe container
        const main = document.querySelector('main');
        const globeContainer = document.createElement('div');
        globeContainer.id = 'globe-container';
        main.appendChild(globeContainer);

        // Style the globe container
        globeContainer.style.position = 'absolute';
        globeContainer.style.top = '50%';
        globeContainer.style.left = '50%';
        globeContainer.style.bottom = '50%';
        globeContainer.style.transform = 'translate(-50%, -50%)';
        globeContainer.style.width = '960px';
        globeContainer.style.height = '800px';
        globeContainer.style.background = 'white';
        globeContainer.style.overflow = 'hidden';
    
  
        // Step 5: Initialize Three.js globe
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, globeContainer.clientWidth / globeContainer.clientHeight, 0.1, 1000);
        camera.position.z =  18;

        const renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(globeContainer.clientWidth, globeContainer.clientHeight);
        globeContainer.appendChild(renderer.domElement);
    
        // Create globe geometry and material
        const geometry = new THREE.SphereGeometry(7, 49, 49);
        const textureLoader = new THREE.TextureLoader();
        const globeTexture = textureLoader.load('./fs-globe-image-10.jpg');
        const material = new THREE.MeshBasicMaterial({ map: globeTexture });
        const globe = new THREE.Mesh(geometry, material);
        scene.add(globe);
    
        // Add OrbitControls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.008;
        controls.enableZoom = true;
        // Restrict zoom to allow only a little zoom in and out
        controls.enableZoom = true;
        controls.minDistance = 15; // Set this to a value slightly closer than the initial camera distance
        controls.maxDistance = 20; // Set this to a value slightly farther than the initial camera distance
            
        window.locations = [
            { name: "KSA, SAUDI ARABIA", lat: 23.8859, lon: 45.0792, projects: [] },
            { name: "DUBAI, UAE", lat: 25.276987, lon: 55.296249, projects: [] },
            { name: "ABU DHABI, UAE", lat: 24.453884, lon: 54.377343, projects: [] },
            { name: "QATAR", lat: 25.276987, lon: 51.520008, projects: [] },
            { name: "MOROCCO", lat: 31.7917, lon: -7.0926, projects: [] },
            { name: "BAHRAIN", lat: 26.0667, lon: 50.5577, projects: [] } // Added Bahrain
        ];
    
      // Create a Set to track processed projects
      const processedProjects = new Set();

      // Process projects only once
      document.querySelectorAll('.project-box').forEach(projectBox => {
          const projectId = projectBox.getAttribute('data-project'); // Unique identifier
          const projectLocation = projectBox.getAttribute('data-location');

          // Skip if already processed
          if (processedProjects.has(projectId)) return;

          const matchingLocation = window.locations.find(loc => 
              loc.name.toLowerCase() === projectLocation.toLowerCase()
          );

          if (matchingLocation) {
              matchingLocation.projects.push(projectBox);
              processedProjects.add(projectId);
          }
      });
    
        // Convert latitude and longitude to Cartesian coordinates
        function latLonToCartesian(lat, lon, radius) {
            const phi = (90 - lat) * (Math.PI / 180);
            const theta = (lon + 180) * (Math.PI / 180);    
            const x = -(radius * Math.sin(phi) * Math.cos(theta));
            const z = radius * Math.sin(phi) * Math.sin(theta);
            const y = radius * Math.cos(phi);
    
            return { x, y, z };
        }
    
            // Step 7: Add markers and icons for projects
            const markerGeometry = new THREE.SphereGeometry(0.1, 15, 15);
            const markerMaterial = new THREE.MeshBasicMaterial({ color: 'red' });
        
            window.locations.forEach(location => {
            const { x, y, z } = latLonToCartesian(location.lat, location.lon, 7);
    
            // Add a base marker for the location
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.set(x, y, z);
            globe.add(marker);
    
            // Add icons for each project
            location.projects.forEach((projectBox, index) => {
                const iconDiv = document.createElement('div');
                iconDiv.classList.add('project-globe-marker');
                iconDiv.style.position = 'absolute';
                iconDiv.style.width = '30px';
                iconDiv.style.height = '30px';
                iconDiv.style.backgroundImage = `url(${projectBox.getAttribute('data-icon')})`;
                iconDiv.style.backgroundSize = 'cover';
                iconDiv.style.cursor = 'pointer';
    
                // Offset icons slightly for stacking
                iconDiv.style.zIndex = 1000 + index;
                iconDiv.addEventListener('click', () => {
                    projectBox.click();
                });
                globeContainer.appendChild(iconDiv);
    
                function updateIconPosition() {
                    // Get the marker's world position
                    const markerPosition = marker.getWorldPosition(new THREE.Vector3());
                    
                    // Get the camera's position
                    const cameraPosition = camera.position.clone();
                    
                    // Calculate the vector normal to the globe's surface (at the marker's position)
                    const markerNormal = markerPosition.clone().normalize();
                    
                    // Calculate the vector from the globe center to the camera
                    const cameraVector = cameraPosition.clone().normalize();
                    
                    // Calculate dot product to determine if marker is facing the camera
                    const dotProduct = markerNormal.dot(cameraVector);
                    
                    // Hide the icon if it's on the far side of the globe (dot product < 0)
                    if (dotProduct < 0) {
                        iconDiv.style.display = 'none';
                        return;
                    }
                    
                    // Apply stacking offset based on index
                    const stackedPosition = markerPosition.clone().add(markerNormal.clone().multiplyScalar(index * 0.15)); // Adjust stacking distance as needed
                    
                    // Project the stacked position to screen coordinates
                    const screenPosition = stackedPosition.project(camera);
                    
                    // Check if the icon is outside the view frustum
                    if (screenPosition.z < -1 || screenPosition.z > 1 ||  // Behind the camera or too far
                        screenPosition.x < -1 || screenPosition.x > 1 ||  // Outside left/right bounds
                        screenPosition.y < -1 || screenPosition.y > 1) {  // Outside top/bottom bounds
                        iconDiv.style.display = 'none';
                        return;
                    }
                    
                    // Show and position the icon
                    iconDiv.style.display = 'block';
                    
                    // Convert normalized screen coordinates to pixel coordinates
                    const x = (screenPosition.x * 0.5 + 0.5) * globeContainer.clientWidth;
                    const y = (-screenPosition.y * 0.5 + 0.5) * globeContainer.clientHeight;
                    
                    // Base size for the icon
                    const baseSize = 1;
                    
                    // Optional: Scale based on distance but maintain minimum size
                    const distance = stackedPosition.distanceTo(cameraPosition);
                    const scale = Math.max(baseSize, Math.min(baseSize * 1.5, baseSize / (distance * 0.1)));
                    
                    // Position and scale the icon
                    iconDiv.style.transform = `translate(-50%, -50%) scale(${scale})`;
                    iconDiv.style.left = `${x}px`;
                    iconDiv.style.top = `${y}px`;
                }
                
                
    
                function animateIcons() {
                    requestAnimationFrame(animateIcons);
                    updateIconPosition();
                }
                animateIcons();
            });
        });
    
        function animate() {
            requestAnimationFrame(animate);
            globe.rotation.y -= 0.0005;
            controls.update();
            renderer.render(scene, camera);
        }
        animate();
    
        window.addEventListener('resize', () => {
            const newWidth = globeContainer.clientWidth;
            const newHeight = globeContainer.clientHeight;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
        });
    }

    else if (criteria === 'epoch') {
            // Hide other headers
            timelineHeader.style.display = 'none';
            alphabeticalHeader.style.display = 'none';
            programmaticHeader.style.display = 'none';
            scaleHeader.style.display = 'none';

        
            // Show the epoch view
            epochHeader.style.display = 'flex';
        
               // Hide or remove the globe container
            const globeContainer = document.getElementById('globe-container');
            if (globeContainer) {
                globeContainer.style.display = 'none'; // Hide the globe
            }
            // Clear all content in the project subcolumns
            const epochProjects = document.querySelector('.epoch-projects');
            epochProjects.querySelectorAll('.epoch-label').forEach(label => {
                label.querySelectorAll('.sub-column').forEach(subColumn => {
                    subColumn.innerHTML = ''; // Clear existing projects
                });
            });
        
            // Create a Set to track added projects
            const addedProjects = new Set();
        
            // Distribute projects into epoch subcolumns
            document.querySelectorAll('.project-box').forEach(projectBox => {
                const projectId = projectBox.getAttribute('data-project'); // Unique identifier
                const projectEpoch = projectBox.getAttribute('data-epoch');
                const epochLabel = epochProjects.querySelector(`.epoch-label[data-epoch="${projectEpoch}"]`);
        
                // Skip if the project has already been added
                if (!epochLabel || addedProjects.has(projectId)) return;
        
                const subColumns = epochLabel.querySelectorAll('.sub-column');
                const leastFilledColumn = Array.from(subColumns).reduce(
                    (minCol, col) =>
                        col.children.length < minCol.children.length ? col : minCol,
                    subColumns[0]
                );
        
                // Clone project box and add click events
                const clonedProject = projectBox.cloneNode(true);
                leastFilledColumn.appendChild(clonedProject);
                addClickEventToProjectBox(clonedProject);
        
                // Mark the project as added
                addedProjects.add(projectId);
            });
        
            // Hide all year columns initially
            yearColumns.forEach(yearColumn => {
                yearColumn.style.display = 'none';
            });
            
        
            reattachTooltipEvents(); // Reattach tooltips after sorting
    }
  
    else if (criteria === 'programmatic') {
            // Show the programmatic header and hide others
            timelineHeader.style.display = 'none';
            alphabeticalHeader.style.display = 'none';
            scaleHeader.style.display = 'none';
            epochHeader.style.display = 'none';
            programmaticHeader.style.display = 'flex';
                      // Hide or remove the globe container
            const globeContainer = document.getElementById('globe-container');
            if (globeContainer) {
                globeContainer.style.display = 'none'; // Hide the globe
            }
            // Hide the year columns
            const yearColumns = document.querySelectorAll('.year-column');
            yearColumns.forEach(yearColumn => {
                yearColumn.style.display = 'none';  // Hide the year columns completely
            });
        
            // Clear all content in the programmatic section
            const programmaticProjects = document.querySelector('.programmatic-projects');
            programmaticProjects.querySelectorAll('.programmatic-label').forEach(label => {
                label.querySelectorAll('.sub-column').forEach(subColumn => {
                    subColumn.innerHTML = ''; // Clear existing content
                });
            });

            // Use a Set to track added projects
            const addedProjects = new Set();

            // Group projects by category
            document.querySelectorAll('.project-box').forEach(projectBox => {
                const projectId = projectBox.getAttribute('data-project'); // Unique identifier
                const projectCategory = projectBox.getAttribute('data-tags');
                const categoryLabel = programmaticProjects.querySelector(`.programmatic-label[data-category="${projectCategory}"]`);

                if (!categoryLabel || addedProjects.has(projectId)) return; // Skip duplicates

                const subColumns = categoryLabel.querySelectorAll('.sub-column');
                const projectsInColumns = Array.from(subColumns).map(subColumn => subColumn.children.length);

                // Find the sub-column with the fewest projects
                const targetSubColumn = subColumns[projectsInColumns.indexOf(Math.min(...projectsInColumns))];

                if (targetSubColumn) {
                    // Clone the project box and append it
                    const clonedProject = projectBox.cloneNode(true);
                    targetSubColumn.appendChild(clonedProject);

                    // Add to Set to prevent duplication
                    addedProjects.add(projectId);

                    // Reattach hover and click events
                    addClickEventToProjectBox(clonedProject);
                }
            });

        // Reattach tooltips or any additional events
        reattachTooltipEvents();

    }
        
     else if (criteria === 'scale') {
        // Hide other headers
        timelineHeader.style.display = 'none';
        alphabeticalHeader.style.display = 'none';
        programmaticHeader.style.display = 'none';
        epochHeader.style.display = 'none';
        scaleHeader.style.display = 'flex'; // Show scale header

       // Hide or remove the globe container
       const globeContainer = document.getElementById('globe-container');
       if (globeContainer) {
           globeContainer.style.display = 'none'; // Hide the globe
       }
        // Clear all content in the project subcolumns
        const scaleProjects = document.querySelector('.scale-projects');
        scaleProjects.querySelectorAll('.scale-label').forEach(label => {
            label.querySelectorAll('.sub-column').forEach(subColumn => {
                subColumn.innerHTML = ''; // Clear existing projects
            });
        });
    
        // Create a Set to track added projects
        const addedProjects = new Set();
    
        // Distribute projects into scale subcolumns
        document.querySelectorAll('.project-box').forEach(projectBox => {
            const projectId = projectBox.getAttribute('data-project'); // Unique identifier
            const projectScale = projectBox.getAttribute('data-scale');
            const scaleLabel = scaleProjects.querySelector(`.scale-label[data-scale="${projectScale}"]`);
    
            // Skip if the project has already been added
            if (!scaleLabel || addedProjects.has(projectId)) return;
    
            const subColumns = scaleLabel.querySelectorAll('.sub-column');
            const leastFilledColumn = Array.from(subColumns).reduce(
                (minCol, col) =>
                    col.children.length < minCol.children.length ? col : minCol,
                subColumns[0]
            );
    
            // Clone project box and add click events
            const clonedProject = projectBox.cloneNode(true);
            leastFilledColumn.appendChild(clonedProject);
            addClickEventToProjectBox(clonedProject);
    
            // Mark the project as added
            addedProjects.add(projectId);
        });
    
        // Hide all year columns initially
        yearColumns.forEach(yearColumn => {
            yearColumn.style.display = 'none';
        });
    
        reattachTooltipEvents(); // Reattach tooltips after sorting
    
    }
    
    else {
            // Show only the timeline header
            timelineHeader.style.display = 'grid';
            alphabeticalHeader.style.display = 'none';
            programmaticHeader.style.display = 'none';
            scaleHeader.style.display = 'none';
            epochHeader.style.display = 'none'; // Ensure epoch header is hidden
        
            // Restore year columns for chronological view
            yearColumns.forEach(yearColumn => {
                yearColumn.style.display = 'flex';
                gallery.appendChild(yearColumn); // Restore original order in the DOM
            });
        
            // Hide the globe container if it exists
            const globeContainer = document.getElementById('globe-container');
            if (globeContainer) {
                globeContainer.style.display = 'none';
            }
    }
        
     };


function setActiveButton(button) {
    const buttons = document.querySelectorAll('.sorting-bar button');
    buttons.forEach(btn => btn.classList.remove('active')); // Remove 'active' from all buttons
    button.classList.add('active'); // Add 'active' to the clicked button
}

document.addEventListener("DOMContentLoaded", function () {
    // Show preloader initially
    const preloader = document.getElementById("preloader");
    document.body.classList.add("loading"); // Prevent scrolling during load

    // Select all sorting buttons
    const buttons = document.querySelectorAll(".sorting-bar button");

    // Ensure the chronological button is active by default
    const chronologicalButton = document.querySelector(".sorting-bar button:nth-child(1)");
    if (chronologicalButton) {
        setActiveButton(chronologicalButton);
        sortProjects('chronological'); // Initialize with chronological sorting

        // Hide other headers explicitly
        const alphabeticalHeader = document.querySelector('.alphabetical-header');
        const programmaticHeader = document.querySelector('.programmatic-header');
        const scaleHeader = document.querySelector('.scale-header');
        const epochHeader = document.getElementById('epochTimeline');
        const globeContainer = document.getElementById('globe-container');

        if (alphabeticalHeader) alphabeticalHeader.style.display = 'none';
        if (programmaticHeader) programmaticHeader.style.display = 'none';
        if (scaleHeader) scaleHeader.style.display = 'none';
        if (epochHeader) epochHeader.style.display = 'none';
        if (globeContainer) globeContainer.style.display = 'none';
    } else {
        console.error("Chronological button not found.");
    }

    // Add click event listeners to all sorting buttons
    buttons.forEach((button) => {
        button.addEventListener("click", function () {
            const criteria = this.textContent.toLowerCase(); // Derive criteria from button text
            setActiveButton(this); // Highlight the active button
            sortProjects(criteria); // Sort projects based on the clicked button
        });
    });

    // Automatically hide the preloader and fade in the page
    setTimeout(() => {
        if (preloader) {
            preloader.style.display = "none";
        }
        document.body.classList.add("loaded"); // Trigger fade-in effect
        document.body.classList.remove("loading"); // Allow scrolling after load
    }, 200); // 2 seconds delay
});



// Create the tooltip element
const tooltip = document.createElement("div");
tooltip.className = "tooltip";
document.body.appendChild(tooltip);

// Handle mouse hover and move for project symbols
document.querySelectorAll('.project-box').forEach((box) => {
    box.addEventListener('mouseenter', function () {
        const title = this.getAttribute('data-title') || 'Untitled Project';
        tooltip.textContent = title;
        tooltip.style.display = "block";
    });

    box.addEventListener('mousemove', function (event) {
        tooltip.style.left = `${event.pageX + 10}px`;
        tooltip.style.top = `${event.pageY + 10}px`;
    });

    box.addEventListener('mouseleave', function () {
        tooltip.style.display = "none";
    });
});
function reattachTooltipEvents() {
    const tooltip = document.querySelector(".tooltip");

    document.querySelectorAll('.project-box').forEach((box) => {
        box.addEventListener('mouseenter', function () {
            const title = this.getAttribute('data-title') || 'Untitled Project';
            tooltip.textContent = title;
            tooltip.style.display = "block";
        });

        box.addEventListener('mousemove', function (event) {
            tooltip.style.left = `${event.pageX + 10}px`;
            tooltip.style.top = `${event.pageY + 10}px`;
        });

        box.addEventListener('mouseleave', function () {
            tooltip.style.display = "none";
        });
    });
}
function updateModal(projectBox) {
    const newImage = projectBox.getAttribute('data-new-image');
    if (newImage) {
        projectImage.src = newImage;
        console.log('Modal image updated to:', newImage);
    } else {
        console.error('Missing data-new-image for project:', projectBox);
    }
}
document.addEventListener("DOMContentLoaded", function () {
    // Get tab and content elements
    const infoSectionLink = document.getElementById("infoSectionLink"); // Main INFO button
    const newsTabLink = document.getElementById("newsTabLink"); // Modal NEWS tab
    const aboutTabLink = document.getElementById("aboutTabLink"); // Modal ABOUT tab
    const newsContent = document.getElementById("newsContent");
    const aboutContent = document.getElementById("aboutContent");
    const closeInfoModal = document.getElementById("closeInfoSectionModal");
    const infoSectionModal = document.getElementById("infoSectionModal");

    // Main INFO button click handler
    infoSectionLink.addEventListener("click", function (event) {
        event.preventDefault();
        infoSectionModal.style.display = "block"; // Show the modal
        // Switch to NEWS content
        newsContent.style.display = "block";
        aboutContent.style.display = "none";
        newsTabLink.classList.add("active");
        aboutTabLink.classList.remove("active");
    });

    // Tab switching logic
    newsTabLink.addEventListener("click", function (event) {
        event.preventDefault();
        newsContent.style.display = "block";
        aboutContent.style.display = "none";
        newsTabLink.classList.add("active");
        aboutTabLink.classList.remove("active");
    });

    aboutTabLink.addEventListener("click", function (event) {
        event.preventDefault();
        newsContent.style.display = "none";
        aboutContent.style.display = "block";
        aboutTabLink.classList.add("active");
        newsTabLink.classList.remove("active");
    });

    // Close modal logic
    closeInfoModal.addEventListener("click", function () {
        infoSectionModal.style.display = "none";
    });
});
