// Document Analyzer JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const fileDetails = document.getElementById('fileDetails');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const fileIcon = document.getElementById('fileIcon');
    const clearFileBtn = document.getElementById('clearFileBtn');
    const searchSection = document.getElementById('searchSection');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchType = document.getElementById('searchType');
    const columnFilter = document.getElementById('columnFilter');
    const columnFilterContainer = document.getElementById('columnFilterContainer');
    const caseSensitive = document.getElementById('caseSensitive');
    const resultsSection = document.getElementById('resultsSection');
    const resultCount = document.getElementById('resultCount');
    const resultsTable = document.getElementById('resultsTable');
    const tableHeader = document.getElementById('tableHeader');
    const tableBody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');
    const pagination = document.getElementById('pagination');
    const resultsPerPage = document.getElementById('resultsPerPage');
    const exportBtn = document.getElementById('exportBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');

    // Application State
    let currentFile = null;
    let fileContent = null;
    let fileData = [];
    let headers = [];
    let filteredData = [];
    let currentPage = 1;
    let itemsPerPage = 10;

    // Initialize Event Listeners
    initEventListeners();

    // Function to initialize all event listeners
    function initEventListeners() {
        // File Upload Event Listeners
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
        fileInput.addEventListener('change', handleFileSelect);
        clearFileBtn.addEventListener('click', clearFile);

        // Search and Filter Event Listeners
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') performSearch();
        });
        resultsPerPage.addEventListener('change', function() {
            itemsPerPage = parseInt(this.value);
            currentPage = 1;
            renderResults();
        });
        exportBtn.addEventListener('click', exportResults);
    }

    // Handle Drag Over Event
    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.add('drag-over');
    }

    // Handle Drag Leave Event
    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('drag-over');
    }

    // Handle Drop Event
    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            processFile(file);
        }
    }

    // Handle File Select Event
    function handleFileSelect(e) {
        if (e.target.files.length) {
            const file = e.target.files[0];
            processFile(file);
        }
    }

    // Process the uploaded file
    function processFile(file) {
        const fileExt = file.name.split('.').pop().toLowerCase();
        
        if (fileExt !== 'csv' && fileExt !== 'pdf') {
            alert('Please upload a CSV or PDF file.');
            return;
        }
        
        showLoading('Processing your file...');
        currentFile = file;
        
        // Update file details UI
        updateFileDetails(file);
        
        // Process based on file type
        if (fileExt === 'csv') {
            processCSV(file);
        } else if (fileExt === 'pdf') {
            processPDF(file);
        }
    }

    // Update file details display
    function updateFileDetails(file) {
        fileDetails.style.display = 'block';
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        
        // Set file icon class based on file type
        fileIcon.className = 'file-icon';
        if (file.name.toLowerCase().endsWith('.csv')) {
            fileIcon.classList.add('csv');
        } else if (file.name.toLowerCase().endsWith('.pdf')) {
            fileIcon.classList.add('pdf');
        }
    }

    // Process CSV file
    function processCSV(file) {
        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: function(results) {
                fileData = results.data;
                headers = results.meta.fields || [];
                
                // Update column filter options
                updateColumnFilterOptions(headers);
                
                // Show search section
                searchSection.style.display = 'block';
                columnFilterContainer.style.display = 'block';
                
                // Hide loading overlay
                hideLoading();
                
                // Reset results
                filteredData = [];
                renderResults();
            },
            error: function(error) {
                console.error('Error parsing CSV:', error);
                alert('Error parsing CSV file. Please check the file format and try again.');
                hideLoading();
            }
        });
    }

    // Process PDF file
    function processPDF(file) {
        const fileReader = new FileReader();
        
        fileReader.onload = function() {
            const typedArray = new Uint8Array(this.result);
            
            // Using PDF.js to read the PDF
            pdfjsLib.getDocument(typedArray).promise.then(function(pdf) {
                fileContent = '';
                let numPages = pdf.numPages;
                let pagesPromises = [];
                
                loadingText.textContent = `Extracting text from PDF (0/${numPages} pages)...`;
                
                // Get text from each page
                for (let i = 1; i <= numPages; i++) {
                    pagesPromises.push(getPageText(pdf, i, numPages));
                }
                
                Promise.all(pagesPromises).then(function() {
                    // Convert PDF content to structured data
                    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
                    
                    // Try to determine if there are headers in the first line
                    let possibleHeaders = lines[0].split(/\s{2,}/).filter(header => header.trim() !== '');
                    headers = possibleHeaders;
                    
                    // Create structured data based on detected columns
                    fileData = [];
                    for (let i = 1; i < lines.length; i++) {
                        let row = {};
                        let values = lines[i].split(/\s{2,}/).filter(value => value.trim() !== '');
                        
                        // Match values to headers
                        for (let j = 0; j < headers.length; j++) {
                            row[headers[j]] = j < values.length ? values[j] : '';
                        }
                        
                        fileData.push(row);
                    }
                    
                    // If no structured data could be detected, create a single column for full text search
                    if (headers.length <= 1) {
                        headers = ['Content'];
                        fileData = lines.map(line => ({ Content: line }));
                    }
                    
                    // Update column filter options
                    updateColumnFilterOptions(headers);
                    
                    // Show search section
                    searchSection.style.display = 'block';
                    columnFilterContainer.style.display = 'block';
                    
                    // Hide loading overlay
                    hideLoading();
                    
                    // Reset results
                    filteredData = [];
                    renderResults();
                });
            }).catch(function(error) {
                console.error('Error reading PDF:', error);
                alert('Error reading PDF file. Please check the file and try again.');
                hideLoading();
            });
        };
        
        fileReader.readAsArrayBuffer(file);
    }

    // Get text from a specific page in the PDF
    function getPageText(pdf, pageNum, totalPages) {
        return pdf.getPage(pageNum).then(function(page) {
            return page.getTextContent().then(function(textContent) {
                let text = '';
                let lastY = -1;
                
                // Concatenate the text items
                textContent.items.forEach(function(item) {
                    if (lastY !== item.transform[5] && lastY !== -1) {
                        text += '\n';
                    }
                    text += item.str + ' ';
                    lastY = item.transform[5];
                });
                
                // Update loading message
                loadingText.textContent = `Extracting text from PDF (${pageNum}/${totalPages} pages)...`;
                
                // Append the text to the overall content
                fileContent += text + '\n';
                return text;
            });
        });
    }

    // Update column filter options based on file headers
    function updateColumnFilterOptions(headers) {
        // Clear existing options except the first one
        while (columnFilter.options.length > 1) {
            columnFilter.remove(1);
        }
        
        // Add options for each header
        headers.forEach(header => {
            const option = document.createElement('option');
            option.value = header;
            option.textContent = header;
            columnFilter.appendChild(option);
        });
    }

    // Perform search based on current search criteria
    function performSearch() {
        const query = searchInput.value.trim();
        
        if (!query) {
            filteredData = [...fileData];
            renderResults();
            return;
        }
        
        const isCaseSensitive = caseSensitive.checked;
        const searchTypeValue = searchType.value;
        const selectedColumn = columnFilter.value;
        
        // Filter data based on search criteria
        filteredData = fileData.filter(row => {
            // If no column is selected, search all columns
            if (selectedColumn === 'all') {
                return Object.values(row).some(value => {
                    if (value === null || value === undefined) return false;
                    return matchesSearchCriteria(value.toString(), query, searchTypeValue, isCaseSensitive);
                });
            } else {
                // Search only the selected column
                let value = row[selectedColumn];
                if (value === null || value === undefined) return false;
                return matchesSearchCriteria(value.toString(), query, searchTypeValue, isCaseSensitive);
            }
        });
        
        // Reset pagination and render results
        currentPage = 1;
        renderResults();
    }

    // Check if value matches search criteria
    function matchesSearchCriteria(value, query, searchType, isCaseSensitive) {
        if (!isCaseSensitive) {
            value = value.toLowerCase();
            query = query.toLowerCase();
        }
        
        switch (searchType) {
            case 'contains':
                return value.includes(query);
            case 'exact':
                return value === query;
            case 'startsWith':
                return value.startsWith(query);
            case 'endsWith':
                return value.endsWith(query);
            default:
                return value.includes(query);
        }
    }

    // Render search results with pagination
    function renderResults() {
        // Show results section
        resultsSection.style.display = 'block';
        
        // Update result count
        resultCount.textContent = filteredData.length;
        
        // If no results, show empty state
        if (filteredData.length === 0) {
            resultsTable.style.display = 'none';
            pagination.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }
        
        // Hide empty state and show table
        emptyState.style.display = 'none';
        resultsTable.style.display = 'table';
        
        // Create table header
        const headerRow = document.createElement('tr');
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });
        tableHeader.innerHTML = '';
        tableHeader.appendChild(headerRow);
        
        // Create pagination
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        const start = (currentPage - 1) * itemsPerPage;
        const end = Math.min(start + itemsPerPage, filteredData.length);
        const pageData = filteredData.slice(start, end);
        
        // Create table body
        tableBody.innerHTML = '';
        pageData.forEach(row => {
            const tr = document.createElement('tr');
            
            headers.forEach(header => {
                const td = document.createElement('td');
                const cellValue = row[header] !== null && row[header] !== undefined ? row[header].toString() : '';
                
                // Highlight search matches if needed
                if (searchInput.value.trim() !== '') {
                    const query = searchInput.value.trim();
                    const isCaseSensitive = caseSensitive.checked;
                    
                    if (matchesSearchCriteria(cellValue, query, searchType.value, isCaseSensitive)) {
                        td.innerHTML = highlightMatch(cellValue, query, isCaseSensitive);
                    } else {
                        td.textContent = cellValue;
                    }
                } else {
                    td.textContent = cellValue;
                }
                
                tr.appendChild(td);
            });
            
            tableBody.appendChild(tr);
        });
        
        // Render pagination controls
        renderPagination(totalPages);
    }

    // Highlight search matches in cell text
    function highlightMatch(text, query, isCaseSensitive) {
        if (!text) return '';
        
        let searchRegex;
        if (isCaseSensitive) {
            searchRegex = new RegExp('(' + escapeRegExp(query) + ')', 'g');
        } else {
            searchRegex = new RegExp('(' + escapeRegExp(query) + ')', 'gi');
        }
        
        return text.replace(searchRegex, '<span class="highlight-match">$1</span>');
    }

    // Escape special characters in string for regex
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Render pagination controls
    function renderPagination(totalPages) {
        if (totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }
        
        pagination.style.display = 'flex';
        pagination.innerHTML = '';
        
        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '«';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderResults();
            }
        });
        pagination.appendChild(prevBtn);
        
        // Page buttons
        const maxButtons = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        
        if (endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.classList.toggle('active', i === currentPage);
            pageBtn.addEventListener('click', () => {
                currentPage = i;
                renderResults();
            });
            pagination.appendChild(pageBtn);
        }
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '»';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderResults();
            }
        });
        pagination.appendChild(nextBtn);
    }

    // Clear current file and reset UI
    function clearFile() {
        currentFile = null;
        fileData = [];
        headers = [];
        filteredData = [];
        currentPage = 1;
        
        fileDetails.style.display = 'none';
        searchSection.style.display = 'none';
        resultsSection.style.display = 'none';
        fileInput.value = '';
    }

    // Export results to CSV
    function exportResults() {
        if (filteredData.length === 0) {
            alert('No data to export.');
            return;
        }
        
        // Create CSV string
        let csv = headers.join(',') + '\n';
        
        filteredData.forEach(row => {
            const values = headers.map(header => {
                let value = row[header];
                if (value === null || value === undefined) value = '';
                
                // Escape commas and quotes
                value = String(value).replace(/"/g, '""');
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value}"`;
                }
                
                return value;
            });
            
            csv += values.join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', 'filtered_data.csv');
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Format file size for display
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Show loading overlay
    function showLoading(text) {
        loadingText.textContent = text || 'Loading...';
        loadingOverlay.style.display = 'flex';
    }

    // Hide loading overlay
    function hideLoading() {
        loadingOverlay.style.display = 'none';
    }
});