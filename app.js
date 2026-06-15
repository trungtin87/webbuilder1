// 1. BIẾN QUẢN LÝ TRẠNG THÁI ỨNG DỤNG
let AVAILABLE_COMPONENTS = []; // Mảng chứa danh sách 60 component sau khi quét thành công
let selectedComponents = [];   // Chứa danh sách các component được chọn theo thứ tự
let currentSearchQuery = '';    // Lưu từ khóa tìm kiếm hiện tại

// Dom Elements
const componentsListEl = document.getElementById('components-list');
const selectedListEl = document.getElementById('selected-list');
const previewContentEl = document.getElementById('preview-content');
const searchInputEl = document.getElementById('search-input');
const exportBtnEl = document.getElementById('export-btn');

// 2. KHỞI CHẠY ỨNG DỤNG
async function init() {
    console.log("🚀 Đang bắt đầu quét dữ liệu từ manifest.json...");
    await loadAllComponents(); 
    
    renderComponentsPanel();
    renderSelectedPanel();
    updatePreview();
    
    // Sự kiện tìm kiếm [cite: 7, 8]
    searchInputEl.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.trim().toLowerCase();
        renderComponentsPanel();
    });

    // Sự kiện Click Export [cite: 5, 9]
    exportBtnEl.addEventListener('click', exportWebsite);
}

// 3. TỰ ĐỘNG QUÉT VÀ PHÂN TÍCH FILE THEO ĐẶC TẢ (SPEC)
async function loadAllComponents() {
    try {
        // Đọc danh sách file từ manifest.json
        const manifestRes = await fetch('components/manifest.json');
        if (!manifestRes.ok) throw new Error("Không thể đọc file components/manifest.json");
        const fileList = await manifestRes.json();

        console.log(`📂 Tìm thấy danh sách gồm ${fileList.length} file component.`);

        for (const fileName of fileList) {
            // Mở block try riêng cho từng file để nếu 1 file lỗi không làm hỏng cả hệ thống
            try {
                const response = await fetch(`components/${fileName}.html`);
                if (!response.ok) {
                    console.warn(`⚠️ Không tìm thấy file: components/${fileName}.html`);
                    continue;
                }
                
                const fileContent = await response.text();
                
                // Định vị metadata
                const metaStart = fileContent.indexOf('<!--builder');
                const metaEnd = fileContent.indexOf('-->', metaStart);
                
                
                if (metaStart === -1 || metaEnd === -1) {
                    console.warn(`⚠️ File ${fileName}.html không chứa block cấu trúc metadata chuẩn SPEC.`);
                    continue;
                }
                
                // Trích xuất metadata và nội dung
                const metaText = fileContent.substring(metaStart + 11, metaEnd);
                
                let type = 'Uncategorized';
                let name = fileName;
                
                const lines = metaText.split('\n');
                lines.forEach(line => {
                    const cleanLine = line.trim();
                    if (cleanLine.startsWith('type=')) {
                        type = cleanLine.split('=')[1].trim();
                    } else if (cleanLine.startsWith('name=')) {
                        name = cleanLine.split('=')[1].trim();
                    }
                });
                
                let htmlContent = fileContent.substring(metaEnd + 3).trim();
                
                // Trích xuất CSS
                let cssContent = '';
                const styleStart = htmlContent.indexOf('<style>');
                const styleEnd = htmlContent.indexOf('</style>');
                if (styleStart !== -1 && styleEnd !== -1) {
                    cssContent = htmlContent.substring(styleStart + 7, styleEnd).trim();
                    htmlContent = htmlContent.substring(0, styleStart) + htmlContent.substring(styleEnd + 8);
                }
                
                // Trích xuất JS
                let jsContent = '';
                const scriptStart = htmlContent.indexOf('<script>');
                const scriptEnd = htmlContent.indexOf('</script>');
                if (scriptStart !== -1 && scriptEnd !== -1) {
                    jsContent = htmlContent.substring(scriptStart + 8, scriptEnd).trim();
                    htmlContent = htmlContent.substring(0, scriptStart) + htmlContent.substring(scriptEnd + 9);
                }
                
                AVAILABLE_COMPONENTS.push({
                    type: type,
                    name: name,
                    html: htmlContent.trim(),
                    css: cssContent,
                    js: jsContent
                });
                
            } catch (fileError) {
                // ĐÂY LÀ PHẦN CATCH BỊ THIẾU MÀ BẠN CẦN NÈ!
                console.error(`❌ Lỗi khi xử lý file dữ liệu ${fileName}:`, fileError);
            }
        }
        
        console.log("✅ Tổng số component đã nạp vào bộ nhớ thành công:", AVAILABLE_COMPONENTS.length);
        console.table(AVAILABLE_COMPONENTS);
        
    } catch (error) {
        // Catch cho toàn bộ quá trình đọc manifest
        console.error("❌ Lỗi hệ thống khi tải manifest:", error);
    }
}


// 4. RENDER COMPONENTS PANEL (Gom nhóm theo phân loại và Tìm kiếm) [cite: 7, 8]
function renderComponentsPanel() {
    componentsListEl.innerHTML = '';
    
    // Lọc theo từ khóa tìm kiếm [cite: 7, 8]
    const filtered = AVAILABLE_COMPONENTS.filter(comp => 
        comp.name.toLowerCase().includes(currentSearchQuery) || 
        comp.type.toLowerCase().includes(currentSearchQuery)
    );

    // Gom nhóm dữ liệu theo 'type' [cite: 7]
    const groups = {};
    filtered.forEach(comp => {
        if (!groups[comp.type]) groups[comp.type] = [];
        groups[comp.type].push(comp);
    });

    // Tạo HTML hiển thị danh sách [cite: 7]
    for (const type in groups) {
        const catTitle = document.createElement('div');
        catTitle.className = 'category-title';
        catTitle.innerText = type.toUpperCase();
        componentsListEl.appendChild(catTitle);

        groups[type].forEach(comp => {
            const isChecked = selectedComponents.some(item => item.name === comp.name);
            
            const itemEl = document.createElement('div');
            itemEl.className = 'component-item';
            itemEl.innerHTML = `
                <input type="checkbox" id="chk-${comp.name}" ${isChecked ? 'checked' : ''}>
                <label for="chk-${comp.name}" style="cursor:pointer; width:100%;">${comp.name}</label>
            `;
            
            itemEl.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const checkbox = itemEl.querySelector('input');
                    checkbox.checked = !checkbox.checked;
                }
                toggleComponent(comp);
            });

            componentsListEl.appendChild(itemEl);
        });
    }
}

// 5. XỬ LÝ BẬT / TẮT CHỌN COMPONENT [cite: 8]
function toggleComponent(comp) {
    const index = selectedComponents.findIndex(item => item.name === comp.name);
    if (index === -1) {
        selectedComponents.push({ ...comp });
    } else {
        selectedComponents.splice(index, 1);
    }
    renderSelectedPanel();
    renderComponentsPanel(); 
    updatePreview();
}

// 6. RENDER SELECTED PANEL (Điều khiển vị trí di chuyển ↑ ↓ ✖) [cite: 8]
function renderSelectedPanel() {
    selectedListEl.innerHTML = '';
    
    if (selectedComponents.length === 0) {
        selectedListEl.innerHTML = '<div style="color:#718093; font-style:italic; font-size:0.85rem; padding: 5px;">Chưa chọn component nào.</div>';
        return;
    }

    selectedComponents.forEach((comp, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'selected-item';
        itemEl.innerHTML = `
            <span>${index + 1}. <b>${comp.name}</b></span>
            <div class="selected-item-actions">
                <button class="btn-up" title="Di chuyển lên">↑</button>
                <button class="btn-down" title="Di chuyển xuống">↓</button>
                <button class="btn-delete" title="Xóa">✖</button>
            </div>
        `;

        itemEl.querySelector('.btn-up').addEventListener('click', () => moveItem(index, -1));
        itemEl.querySelector('.btn-down').addEventListener('click', () => moveItem(index, 1));
        itemEl.querySelector('.btn-delete').addEventListener('click', () => {
            selectedComponents.splice(index, 1);
            renderSelectedPanel();
            renderComponentsPanel();
            updatePreview();
        });

        selectedListEl.appendChild(itemEl);
    });
}

function moveItem(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= selectedComponents.length) return;
    
    const temp = selectedComponents[index];
    selectedComponents[index] = selectedComponents[newIndex];
    selectedComponents[newIndex] = temp;
    
    renderSelectedPanel();
    updatePreview();
}

// 7. CẬP NHẬT LIVE PREVIEW (Giao diện hiển thị trực quan) [cite: 9]
function updatePreview() {
    previewContentEl.innerHTML = '';
    
    if (selectedComponents.length === 0) {
        previewContentEl.innerHTML = '<div style="padding: 20px; color: #aaa; text-align: center;">Vùng hiển thị Preview trống</div>';
        return;
    }

    let combinedHTML = '';
    let combinedCSS = '';

    selectedComponents.forEach(comp => {
        combinedHTML += comp.html + "\n";
        combinedCSS += comp.css + "\n";
    });

    const styleEl = document.createElement('style');
    styleEl.innerHTML = combinedCSS;
    
    previewContentEl.innerHTML = combinedHTML;
    previewContentEl.appendChild(styleEl);
}

// 8. XUẤT ĐÓNG GÓI TẢI FILE INDEX.HTML XUỐNG [cite: 5, 9]
function exportWebsite() {
    if (selectedComponents.length === 0) {
        alert("Vui lòng tích chọn ít nhất một khối giao diện để tải về!");
        return;
    }

    let bodyContent = '';
    let stylesContent = '';
    let scriptsContent = '';

    selectedComponents.forEach(comp => {
        bodyContent += `\t\n${comp.html.split('\n').map(line => '\t' + line).join('\n')}\n\n`;
        if (comp.css) {
            stylesContent += `\t\t/* Style for ${comp.name} */\n${comp.css.split('\n').map(line => '\t\t' + line).join('\n')}\n\n`;
        }
        if (comp.js) {
            scriptsContent += `\t\t// Script for ${comp.name}\n${comp.js.split('\n').map(line => '\t\t' + line).join('\n')}\n\n`;
        }
    });

    const finalHTMLStructure = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trang Web Hoàn Chỉnh Của Tôi</title>
    <style>
        /* Base Reset gọn gàng tránh xung đột toàn cục */
        body { margin: 0; padding: 0; box-sizing: border-box; font-family: sans-serif; }
\n${stylesContent}    </style>
</head>
<body>

\n${bodyContent}
    <script>
        document.addEventListener("DOMContentLoaded", function() {
\n${scriptsContent}        });
    </script>
</body>
</html>`;

    const blob = new Blob([finalHTMLStructure], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'index.html'; // [cite: 5, 9]
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
}

// Chạy khởi tạo hệ thống
init();