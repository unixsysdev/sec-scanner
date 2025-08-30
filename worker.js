/**
 * Cloudflare Worker for PHP Code Graph Explorer
 * Converts the HTML application to work as a serverless function
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Handle file upload POST requests
        if (request.method === 'POST' && url.pathname === '/upload') {
            return handleFileUpload(request);
        }

        // Handle all other requests by serving the HTML
        return new Response(getHTML(), {
            headers: {
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    },
};

async function handleFileUpload(request) {
    try {
        const contentType = request.headers.get('content-type') || '';

        if (!contentType.includes('multipart/form-data')) {
            return new Response(JSON.stringify({ error: 'Expected multipart/form-data' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || !file.name.endsWith('.json')) {
            return new Response(JSON.stringify({ error: 'Please upload a .json file' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Read the file content
        const fileContent = await file.text();

        // Validate JSON
        let graphData;
        try {
            graphData = JSON.parse(fileContent);
        } catch (e) {
            return new Response(JSON.stringify({ error: 'Invalid JSON file' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Return the processed graph data
        return new Response(JSON.stringify({
            success: true,
            data: graphData,
            filename: file.name
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: 'Upload failed: ' + error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

function getHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PHP Code Graph Explorer</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            min-height: 100vh;
            color: #333;
            overflow: hidden;
        }

        .container {
            display: flex;
            height: 100vh;
            position: relative;
        }

        .sidebar {
            width: 550px;
            min-width: 450px;
            max-width: 800px;
            background: rgba(255, 255, 255, 0.98);
            padding: 18px;
            overflow-y: auto;
            box-shadow: 4px 0 20px rgba(0,0,0,0.2);
            position: relative;
            display: flex;
            flex-direction: column;
        }

        .resize-handle {
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            width: 6px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            cursor: ew-resize;
            opacity: 0.4;
            transition: opacity 0.3s;
        }

        .resize-handle:hover {
            opacity: 1;
        }

        .main-panel {
            flex: 1;
            background: rgba(255, 255, 255, 0.98);
            position: relative;
            overflow: hidden;
            padding: 5px;
        }

        h1 {
            font-size: 20px;
            margin-bottom: 12px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: 600;
        }

        h2 {
            font-size: 12px;
            margin: 8px 0 6px;
            color: #666;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .section-badge {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 1px 5px;
            border-radius: 6px;
            font-size: 8px;
            font-weight: normal;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 16px;
        }

        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px;
            border-radius: 8px;
            transition: transform 0.2s;
            position: relative;
            overflow: hidden;
        }

        .stat-card::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: pulse 3s ease-in-out infinite;
        }

        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 0.8; }
        }

        .stat-card:hover {
            transform: translateY(-1px) scale(1.01);
        }

        .stat-value {
            font-size: 16px;
            font-weight: 600;
            position: relative;
        }

        .stat-label {
            font-size: 9px;
            opacity: 0.8;
            margin-top: 1px;
            position: relative;
        }

        .graph-metrics {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 12px;
            border: 1px solid rgba(102, 126, 234, 0.2);
        }

        .metric-row {
            display: flex;
            justify-content: space-between;
            margin: 4px 0;
            font-size: 11px;
        }

        .metric-label {
            color: #777;
        }

        .metric-value {
            font-weight: 500;
            color: #764ba2;
        }

        .search-section {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 10px;
            border: 1px solid transparent;
            transition: all 0.3s;
        }

        .search-section.active {
            border-color: #667eea;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.03), rgba(118, 75, 162, 0.03));
        }

        .search-box {
            width: 100%;
            padding: 6px 10px;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            font-size: 12px;
            margin-bottom: 6px;
            transition: all 0.3s;
            background: white;
        }

        .search-box:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
        }

        /* Search container with clear button */
        .search-container {
            position: relative;
            display: flex;
            align-items: center;
        }

        .search-box {
            width: 100%;
            padding: 6px 35px 6px 10px; /* Extra padding for clear button */
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            font-size: 12px;
            margin-bottom: 6px;
            transition: all 0.3s;
            background: white;
        }

        .clear-search-btn {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: #999;
            cursor: pointer;
            font-size: 14px;
            padding: 2px;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            opacity: 0;
        }

        .clear-search-btn:hover {
            background: rgba(102, 126, 234, 0.1);
            color: #667eea;
            transform: translateY(-50%) scale(1.1);
        }

        .search-container.has-text .clear-search-btn {
            opacity: 1;
        }

        .filter-buttons {
            display: flex;
            gap: 4px;
            margin-bottom: 8px;
            flex-wrap: wrap;
        }

        .filter-btn {
            padding: 3px 8px;
            border: 1px solid #667eea;
            background: white;
            color: #667eea;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10px;
            font-weight: 500;
            transition: all 0.2s;
        }

        .filter-btn:hover {
            background: #667eea;
            color: white;
            transform: translateY(-0.5px);
        }

        .filter-btn.active {
            background: #667eea;
            color: white;
        }

        .node-list {
            max-height: 350px;
            overflow-y: auto;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 5px;
            background: white;
            resize: vertical;
        }

        .remove-node {
            cursor: pointer;
            color: #ff6b6b;
            font-weight: bold;
            padding: 0 2px;
            font-size: 10px;
        }

        .remove-node:hover {
            background: #ffeeee;
            border-radius: 2px;
        }

        .node-list.search-results {
            max-height: 450px;
            border: 1px solid #667eea;
            background: linear-gradient(to bottom, white, #f8f9ff);
            resize: vertical;
        }

        .node-item {
            padding: 6px;
            margin: 2px 0;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid transparent;
            position: relative;
        }

        .node-item:hover {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08));
            border-color: #667eea;
            transform: translateX(3px);
        }

        .node-item.in-graph {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15));
            border-color: #764ba2;
        }

        .node-item.in-graph::before {
            content: '✓';
            position: absolute;
            left: -10px;
            color: #764ba2;
            font-weight: normal;
            font-size: 10px;
        }

        .node-info {
            flex: 1;
            min-width: 0;
        }

        .node-name {
            font-weight: 500;
            color: #444;
            margin-bottom: 1px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 12px;
        }

        .node-meta {
            font-size: 9px;
            color: #777;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .node-badge {
            padding: 2px 5px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: 500;
            text-transform: uppercase;
            white-space: nowrap;
        }

        .badge-class { background: #e3f2fd; color: #1976d2; }
        .badge-method { background: #f3e5f5; color: #7b1fa2; }
        .badge-function { background: #e8f5e9; color: #388e3c; }

        .connection-count {
            font-size: 8px;
            color: #aaa;
            margin-left: 4px;
        }

        #graph-svg {
            width: 100%;
            height: 100%;
        }

        .controls {
            position: absolute;
            top: 15px;
            right: 15px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 100;
            background: white;
            padding: 12px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .control-group {
            display: flex;
            gap: 6px;
        }

        .control-btn {
            padding: 6px 14px;
            background: white;
            border: 2px solid #667eea;
            color: #667eea;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
            font-size: 11px;
            white-space: nowrap;
        }

        .control-btn:hover {
            background: #667eea;
            color: white;
        }

        .control-btn.active {
            background: #667eea;
            color: white;
        }

        .control-label {
            font-size: 10px;
            color: #666;
            margin-bottom: 4px;
            font-weight: 600;
        }

        .drop-zone {
            border: 3px dashed #667eea !important;
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            margin-bottom: 20px;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08));
            transition: all 0.3s;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
            position: relative;
        }

        .drop-zone::before {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 12px;
            z-index: -1;
            opacity: 0.1;
        }

        .drop-zone.dragover {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
            border-color: #764ba2 !important;
            transform: scale(1.02);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.25);
        }

        .drop-zone.dragover::before {
            opacity: 0.2;
        }

        /* Loading and progress indicators */
        .upload-status {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            text-align: center;
            z-index: 10000;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            display: none;
            max-width: 300px;
        }

        .upload-status.visible {
            display: block;
        }

        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .upload-progress {
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            overflow: hidden;
            margin: 10px 0;
        }

        .upload-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            width: 0%;
            transition: width 0.3s ease;
            border-radius: 3px;
        }

        .upload-message {
            font-size: 14px;
            margin-bottom: 5px;
            font-weight: 500;
        }

        .upload-submessage {
            font-size: 12px;
            opacity: 0.8;
            margin-top: 5px;
        }

        /* Drop zone loading state */
        .drop-zone.loading {
            pointer-events: none;
            opacity: 0.7;
        }

        .drop-zone.loading p {
            color: #666;
        }

        .drop-zone.loading::after {
            content: '⏳ Processing...';
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 12px;
            color: #667eea;
            font-weight: 500;
        }

        .drop-zone p {
            color: #667eea;
            font-weight: 500;
            margin-bottom: 6px;
            font-size: 15px;
        }

        .file-input {
            display: none;
        }

        .file-label {
            display: inline-block;
            padding: 6px 14px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 500;
            transition: transform 0.2s;
            font-size: 13px;
        }

        .file-label:hover {
            transform: translateY(-1px);
        }

        .demo-btn {
            display: inline-block;
            padding: 8px 16px;
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 12px;
            transition: all 0.2s;
            margin-top: 8px;
        }

        .demo-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);
        }

        .demo-btn:active {
            transform: translateY(0);
        }

        /* Graph styles */
        .node {
            cursor: pointer;
        }

        .node circle {
            stroke-width: 3px;
            transition: all 0.3s;
        }

        .node:hover circle {
            stroke-width: 5px;
            filter: brightness(1.2);
        }

        .node text {
            font-size: 10px;
            pointer-events: none;
            text-anchor: middle;
            fill: #333;
            font-weight: 600;
            stroke: white;
            stroke-width: 2px;
            paint-order: stroke;
        }

        .link {
            stroke-opacity: 0.4;
            transition: all 0.3s;
        }

        .link:hover {
            stroke-opacity: 0.8;
            stroke-width: 3px !important;
        }

        .link.extends { stroke: #4CAF50; }
        .link.instantiates { stroke: #FF9800; }
        .link.static_call { stroke: #2196F3; }
        .link.method_call { stroke: #9C27B0; }

        /* Tooltip */
        .tooltip {
            position: absolute;
            padding: 10px;
            background: rgba(0, 0, 0, 0.95);
            color: white;
            border-radius: 6px;
            font-size: 11px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
            z-index: 1000;
            max-width: 280px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .tooltip strong {
            color: #667eea;
        }

        .legend {
            position: absolute;
            bottom: 15px;
            left: 15px;
            background: white;
            padding: 12px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .legend-title {
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 6px;
            color: #666;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 4px 0;
            font-size: 11px;
        }

        .legend-color {
            width: 18px;
            height: 3px;
        }

        /* Scrollbar styling */
        .node-list::-webkit-scrollbar,
        .sidebar::-webkit-scrollbar {
            width: 6px;
        }

        .node-list::-webkit-scrollbar-track,
        .sidebar::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
        }

        .node-list::-webkit-scrollbar-thumb,
        .sidebar::-webkit-scrollbar-thumb {
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 10px;
        }

        .node-list::-webkit-scrollbar-thumb:hover,
        .sidebar::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(135deg, #764ba2, #667eea);
        }

        .depth-controls {
            display: flex;
            gap: 6px;
            align-items: center;
            margin-top: 6px;
            padding: 6px;
            background: #f8f9fa;
            border-radius: 4px;
        }

        .depth-label {
            font-size: 10px;
            color: #777;
            font-weight: 500;
        }

        .depth-input {
            width: 45px;
            padding: 2px 5px;
            border: 1px solid #e0e0e0;
            border-radius: 3px;
            font-size: 10px;
        }

        .no-results {
            text-align: center;
            padding: 16px;
            color: #999;
            font-style: italic;
            font-size: 12px;
        }

        /* Enhanced section separation */
        .sidebar > div:not(:last-child) {
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-bottom: 1px solid rgba(102, 126, 234, 0.1);
        }

        .sidebar > div:last-child {
            margin-bottom: 8px;
        }

        /* Section headers with better visual separation */
        .sidebar h1 {
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid rgba(102, 126, 234, 0.3);
        }

        .sidebar h2 {
            margin: 12px 0 8px;
            padding: 8px 12px;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08));
            border-radius: 6px;
            border-left: 3px solid #667eea;
            font-weight: 600;
        }

        /* Stats cards with better spacing */
        .stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 20px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 8px;
            border: 1px solid rgba(102, 126, 234, 0.1);
        }

        /* Graph metrics with enhanced styling */
        .graph-metrics {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08));
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
            border: 1px solid rgba(102, 126, 234, 0.15);
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        /* Search section with better visual separation */
        .search-section {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
            border: 1px solid rgba(102, 126, 234, 0.1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .search-section.active {
            border-color: #667eea;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.03), rgba(118, 75, 162, 0.03));
            box-shadow: 0 4px 8px rgba(102, 126, 234, 0.1);
        }

        /* Node list containers with better borders */
        .node-list {
            max-height: 350px;
            overflow-y: auto;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            padding: 8px;
            background: white;
            resize: vertical;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
        }

        .node-list.search-results {
            max-height: 450px;
            border: 2px solid #667eea;
            background: linear-gradient(to bottom, white, #f8f9ff);
            box-shadow: inset 0 1px 3px rgba(102, 126, 234, 0.1);
        }

        /* Depth controls with enhanced styling */
        .depth-controls {
            display: flex;
            gap: 8px;
            align-items: center;
            margin-top: 8px;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid rgba(102, 126, 234, 0.1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        /* Node children section with better separation */
        #nodeChildrenSection {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 2px solid rgba(102, 126, 234, 0.2);
        }

        /* Enhanced node item styling */
        .node-item {
            padding: 8px 10px;
            margin: 3px 0;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid rgba(0,0,0,0.05);
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .node-item:hover {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08));
            border-color: #667eea;
            transform: translateX(3px);
            box-shadow: 0 2px 4px rgba(102, 126, 234, 0.1);
        }

        .node-item.in-graph {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15));
            border-color: #764ba2;
            box-shadow: 0 2px 4px rgba(118, 75, 162, 0.1);
        }

        /* Filter controls with better visual separation */
        .graph-filter-controls {
            display: flex;
            gap: 8px;
            align-items: center;
            margin-bottom: 10px;
            padding: 8px;
            background: rgba(102, 126, 234, 0.05);
            border-radius: 6px;
            border: 1px solid rgba(102, 126, 234, 0.1);
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        /* Graph Filter Styles */
        .graph-filter {
            position: absolute;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 100;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 25px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(102, 126, 234, 0.2);
            transition: all 0.3s ease;
            opacity: 0;
            pointer-events: none;
        }

        .graph-filter.visible {
            opacity: 1;
            pointer-events: all;
        }

        .graph-filter-content {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
        }

        .graph-search-input {
            width: 200px;
            padding: 6px 12px;
            border: 1px solid #e0e0e0;
            border-radius: 15px;
            font-size: 12px;
            background: white;
            transition: all 0.3s ease;
            outline: none;
        }

        .graph-search-input:focus {
            border-color: #667eea;
            box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
            width: 250px;
        }

        .graph-filter-btn, .graph-delete-btn, .graph-highlight-btn {
            padding: 6px 10px;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            transition: all 0.2s ease;
            background: #f8f9fa;
            color: #666;
        }

        .graph-filter-btn:hover {
            background: #667eea;
            color: white;
            transform: scale(1.05);
        }

        .graph-delete-btn:hover {
            background: #ff6b6b;
            color: white;
            transform: scale(1.05);
        }

        .graph-highlight-btn:hover {
            background: #ffd700;
            color: #333;
            transform: scale(1.05);
        }

        .graph-filter-btn.active {
            background: #667eea;
            color: white;
        }

        .graph-delete-btn.active {
            background: #ff6b6b;
            color: white;
        }

        .graph-highlight-btn.active {
            background: #ffd700;
            color: #333;
        }

        /* Filtered node styles */
        .node.filtered {
            filter: brightness(1.3) saturate(1.5);
        }

        .node.filtered circle {
            stroke: #ffd700 !important;
            stroke-width: 4px !important;
        }

        .node.filtered text {
            fill: #ffd700 !important;
            font-weight: bold !important;
        }

        .node.to-delete {
            filter: brightness(0.7) opacity(0.6);
        }

        .node.to-delete circle {
            stroke: #ff6b6b !important;
            stroke-width: 4px !important;
        }

        .node.to-delete text {
            fill: #ff6b6b !important;
        }

        /* Integrated Graph Filter Styles */
        .graph-filter-controls {
            display: flex;
            gap: 6px;
            align-items: center;
            margin-bottom: 8px;
            padding: 6px;
            background: rgba(102, 126, 234, 0.05);
            border-radius: 6px;
            border: 1px solid rgba(102, 126, 234, 0.1);
        }

        .graph-filter-input {
            flex: 1;
            padding: 4px 8px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            font-size: 11px;
            background: white;
            transition: all 0.3s ease;
            outline: none;
        }

        .graph-filter-input:focus {
            border-color: #667eea;
            box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
        }

        .graph-filter-actions {
            display: flex;
            gap: 4px;
        }

        .graph-filter-actions button {
            padding: 3px 6px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 9px;
            font-weight: 500;
            transition: all 0.2s ease;
        }

        .graph-filter-actions .graph-delete-btn {
            background: #ff6b6b;
            color: white;
        }

        .graph-filter-actions .graph-delete-btn:hover {
            background: #e53e3e;
            transform: translateY(-1px);
        }

        .graph-filter-actions .graph-clear-filter-btn {
            background: #f7fafc;
            color: #666;
            border: 1px solid #e2e8f0;
        }

        .graph-filter-actions .graph-clear-filter-btn:hover {
            background: #edf2f7;
            transform: translateY(-1px);
        }

        /* Filtered nodes in sidebar */
        .node-item.filtered {
            background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 193, 7, 0.1));
            border-color: #ffd700;
        }

        .node-item.to-delete {
            background: linear-gradient(135deg, rgba(255, 107, 107, 0.1), rgba(229, 62, 62, 0.1));
            border-color: #ff6b6b;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="sidebar" id="sidebar">
            <div class="resize-handle" id="resizeHandle"></div>

            <h1>PHP Code Explorer</h1>

            <div class="drop-zone" id="dropZone">
                <p>📁 Drop php_graph.json here</p>
                <label for="fileInput" class="file-label">Choose File</label>
                <input type="file" id="fileInput" class="file-input" accept=".json">
                <br><br>
                <button class="demo-btn" id="loadDemoBtn" title="Load demo data from AlpinResorts repositories">🚀 Load Demo Data</button>
            </div>

            <div id="sidebar-content" style="display: none;">
                <div class="stats" id="stats"></div>

                <div class="graph-metrics" id="graphMetrics">
                    <div class="metric-row">
                        <span class="metric-label">Displayed Nodes:</span>
                        <span class="metric-value" id="displayedNodes">0</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Displayed Edges:</span>
                        <span class="metric-value" id="displayedEdges">0</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Max Depth:</span>
                        <span class="metric-value" id="maxDepth">0</span>
                    </div>
                </div>

                <div class="search-section" id="searchSection">
                    <h2>🔍 Search & Filter</h2>
                    <div class="search-container">
                        <input type="text" class="search-box" id="searchBox" placeholder="Search nodes by name...">
                        <button class="clear-search-btn" id="clearSearchBtn" title="Clear search">×</button>
                    </div>

                    <div class="filter-buttons">
                        <button class="filter-btn active" data-type="all">All</button>
                        <button class="filter-btn" data-type="class">Classes</button>
                        <button class="filter-btn" data-type="method">Methods</button>
                        <button class="filter-btn" data-type="function">Functions</button>
                    </div>

                    <div class="node-list search-results" id="searchResults" style="display: none;"></div>
                </div>

                <h2>📌 Nodes in Graph <span class="section-badge" id="selectedCount">0</span></h2>
                <div class="graph-filter-controls">
                    <input type="text" class="graph-filter-input" id="graphFilterInput" placeholder="🔍 Filter nodes...">
                    <div class="graph-filter-actions">
                        <button class="graph-delete-btn" id="graphDeleteBtn" title="Delete filtered nodes">🗑️ Delete</button>
                        <button class="graph-clear-filter-btn" id="graphClearFilterBtn" title="Clear filter">❌ Clear</button>
                    </div>
                </div>
                <div class="node-list" id="selectedNodes" style="max-height: 200px; resize: vertical;"></div>

                <div id="nodeChildrenSection" style="display: none;">
                    <h2>👶 Children of Selected Node <span class="section-badge" id="childrenCount">0</span></h2>
                    <input type="text" class="search-box" id="childrenSearch" placeholder="Filter children...">
                    <div class="node-list" id="nodeChildrenList" style="max-height: 300px; resize: vertical;"></div>
                    <button class="filter-btn" id="closeChildren" style="font-size: 9px; padding: 2px 6px;">Close</button>
                </div>

                <div class="depth-controls">
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="depth-label">Depth:</span>
                            <input type="number" class="depth-input" id="depthInput" value="2" min="0" max="5" title="How many levels of connections to show">
                            <span class="depth-label">Connections:</span>
                            <input type="number" class="depth-input" id="connectionsInput" value="5" min="1" max="10" title="Max connections per level">
                            <button class="filter-btn" id="applyDepth" title="Apply settings to current graph">Apply</button>
                            <button class="filter-btn" id="resetView" title="Reset to default view">Reset</button>
                        </div>
                        <span style="font-size: 11px; color: #999;">⚡ Depth = how far, Connections = how many per level</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="main-panel">
            <div class="controls">
                <div class="control-label">Graph Controls</div>
                <div class="control-group">
                    <button class="control-btn" id="clearBtn" title="Remove all nodes from view">🗑️ Clear</button>
                    <button class="control-btn" id="fitBtn" title="Zoom to fit all nodes">🎯 Center</button>
                    <button class="control-btn" id="expandDistanceBtn" title="Increase distance between nodes">Expand</button>
                    <button class="control-btn" id="reduceDistanceBtn" title="Reduce distance between nodes">Cluster</button>
                </div>
            </div>

            <div class="graph-filter" id="graphFilter">
                <div class="graph-filter-content">
                    <input type="text" class="graph-search-input" id="graphSearchInput" placeholder="🔍 Filter nodes in graph...">
                    <button class="graph-filter-btn" id="graphFilterBtn" title="Toggle filter visibility">🔍</button>
                    <button class="graph-delete-btn" id="graphDeleteBtn" title="Delete filtered nodes">🗑️</button>
                    <button class="graph-highlight-btn" id="graphHighlightBtn" title="Highlight filtered nodes">⭐</button>
                </div>
            </div>

            <svg id="graph-svg"></svg>

            <div class="legend">
                <div class="legend-title">Edge Types</div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #4CAF50;"></div>
                    <span>Extends</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #FF9800;"></div>
                    <span>Instantiates</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #2196F3;"></div>
                    <span>Static Call</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #9C27B0;"></div>
                    <span>Method Call</span>
                </div>
            </div>
        </div>
    </div>

    <div class="tooltip" id="tooltip"></div>

    <!-- Upload Status Overlay -->
    <div class="upload-status" id="uploadStatus">
        <div class="loading-spinner"></div>
        <div class="upload-message" id="uploadMessage">Uploading file...</div>
        <div class="upload-progress">
            <div class="upload-progress-bar" id="uploadProgressBar"></div>
        </div>
        <div class="upload-submessage" id="uploadSubmessage">Please wait while we process your data</div>
    </div>

    <script>
        class GraphExplorer {
            constructor() {
                this.fullGraph = { nodes: [], edges: [] };
                this.displayedNodes = new Set();
                this.displayedEdges = [];
                this.simulation = null;
                this.currentFilter = 'all';
                this.connectionDepth = 2;
                this.connectionsPerLevel = 5;
                this.currentConnections = [];

                this.initializeUI();
                setTimeout(() => this.initializeGraph(), 100);
            }

            initializeUI() {
                // Panel resizing
                const sidebar = document.getElementById('sidebar');
                const resizeHandle = document.getElementById('resizeHandle');
                let isResizing = false;

                resizeHandle.addEventListener('mousedown', (e) => {
                    isResizing = true;
                    document.body.style.cursor = 'ew-resize';
                });

                document.addEventListener('mousemove', (e) => {
                    if (!isResizing) return;

                    const newWidth = e.clientX;
                    if (newWidth > 300 && newWidth < 600) {
                        sidebar.style.width = newWidth + 'px';
                        this.fitView();
                    }
                });

                document.addEventListener('mouseup', () => {
                    isResizing = false;
                    document.body.style.cursor = 'default';
                });

                // File handling
                const dropZone = document.getElementById('dropZone');
                const fileInput = document.getElementById('fileInput');

                dropZone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropZone.classList.add('dragover');
                });

                dropZone.addEventListener('dragleave', () => {
                    dropZone.classList.remove('dragover');
                });

                dropZone.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('dragover');
                    const file = e.dataTransfer.files[0];
                    if (file && file.type === 'application/json') {
                        await this.uploadFile(file);
                    }
                });

                fileInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        await this.uploadFile(file);
                    }
                });

                // Demo data button
                const loadDemoBtn = document.getElementById('loadDemoBtn');
                if (loadDemoBtn) {
                    loadDemoBtn.addEventListener('click', async () => {
                        await this.loadDemoData();
                    });
                }

                // Search
                const searchBox = document.getElementById('searchBox');
                const searchSection = document.getElementById('searchSection');
                const searchContainer = searchBox.parentElement;
                const clearSearchBtn = document.getElementById('clearSearchBtn');

                searchBox.addEventListener('input', (e) => {
                    const query = e.target.value;
                    if (query) {
                        searchSection.classList.add('active');
                        document.getElementById('searchResults').style.display = 'block';
                        searchContainer.classList.add('has-text');
                    } else {
                        searchSection.classList.remove('active');
                        document.getElementById('searchResults').style.display = 'none';
                        searchContainer.classList.remove('has-text');
                    }
                    this.searchNodes(query);
                });

                // Clear search button
                clearSearchBtn.addEventListener('click', () => {
                    searchBox.value = '';
                    searchSection.classList.remove('active');
                    document.getElementById('searchResults').style.display = 'none';
                    searchContainer.classList.remove('has-text');
                    this.searchNodes('');
                });

                // Filters
                document.querySelectorAll('.filter-btn').forEach(btn => {
                    if (btn.dataset.type) {
                        btn.addEventListener('click', () => {
                            document.querySelectorAll('.filter-btn[data-type]').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                            this.currentFilter = btn.dataset.type;
                            this.searchNodes(searchBox.value);
                        });
                    }
                });

                // Controls
                document.getElementById('clearBtn').addEventListener('click', () => this.clearGraph());
                document.getElementById('fitBtn').addEventListener('click', () => this.fitView());
                document.getElementById('expandDistanceBtn').addEventListener('click', () => this.expandDistances());
                document.getElementById('reduceDistanceBtn').addEventListener('click', () => this.reduceDistances());

                // Children section controls
                const closeChildrenBtn = document.getElementById('closeChildren');
                if (closeChildrenBtn) {
                    closeChildrenBtn.addEventListener('click', () => {
                        document.getElementById('nodeChildrenSection').style.display = 'none';
                        const childrenTitle = document.querySelector('#nodeChildrenSection h2');
                        if (childrenTitle) {
                            childrenTitle.innerHTML = \`👶 Children of Selected Node <span class="section-badge" id="childrenCount">0</span>\`;
                        }
                    });
                }

                // Children search
                const childrenSearch = document.getElementById('childrenSearch');
                if (childrenSearch) {
                    childrenSearch.addEventListener('input', (e) => {
                        this.filterChildren(e.target.value);
                    });
                }

                // Depth control
                const depthInput = document.getElementById('depthInput');
                const connectionsInput = document.getElementById('connectionsInput');
                const applyDepthBtn = document.getElementById('applyDepth');

                depthInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        const oldDepth = this.connectionDepth;
                        this.connectionDepth = parseInt(depthInput.value) || 1;
                        this.connectionsPerLevel = parseInt(connectionsInput.value) || 5;
                        this.applyDepthToGraph(oldDepth);
                    }
                });

                connectionsInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        const oldDepth = this.connectionDepth;
                        this.connectionDepth = parseInt(depthInput.value) || 1;
                        this.connectionsPerLevel = parseInt(connectionsInput.value) || 5;
                        this.applyDepthToGraph(oldDepth);
                    }
                });

                applyDepthBtn.addEventListener('click', () => {
                    const oldDepth = this.connectionDepth;
                    this.connectionDepth = parseInt(depthInput.value) || 1;
                    this.connectionsPerLevel = parseInt(connectionsInput.value) || 5;
                    this.applyDepthToGraph(oldDepth);
                });

                // Reset view button
                const resetViewBtn = document.getElementById('resetView');
                resetViewBtn.addEventListener('click', () => {
                    this.resetToDefaultView();
                });

                // Graph filter functionality
                const graphFilterInput = document.getElementById('graphFilterInput');
                const graphDeleteBtn = document.getElementById('graphDeleteBtn');
                const graphClearFilterBtn = document.getElementById('graphClearFilterBtn');

                if (graphFilterInput) {
                    graphFilterInput.addEventListener('input', (e) => {
                        this.filterGraphNodes(e.target.value);
                    });
                }

                if (graphDeleteBtn) {
                    graphDeleteBtn.addEventListener('click', () => {
                        this.deleteFilteredNodes();
                    });
                }

                if (graphClearFilterBtn) {
                    graphClearFilterBtn.addEventListener('click', () => {
                        if (graphFilterInput) {
                            graphFilterInput.value = '';
                        }
                        this.clearGraphFilter();
                    });
                }
            }

            async uploadFile(file) {
                const formData = new FormData();
                formData.append('file', file);

                // Show loading state
                this.showUploadProgress('Uploading file...', 'Sending data to server...');

                try {
                    const response = await fetch('/upload', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        throw new Error(\`HTTP error! status: \${response.status}\`);
                    }

                    this.updateUploadProgress(50, 'Processing response...', 'Parsing server response...');

                    const result = await response.json();

                    if (result.success) {
                        this.updateUploadProgress(75, 'Processing graph data...', 'Building graph structure...');

                        // Simulate processing time for large files
                        await new Promise(resolve => setTimeout(resolve, 500));

                        this.fullGraph = result.data;
                        this.processGraph();

                        this.updateUploadProgress(100, 'Complete!', 'Graph ready to explore');
                        await new Promise(resolve => setTimeout(resolve, 300));

                        // Hide loading and show content
                        this.hideUploadProgress();
                        document.getElementById('dropZone').style.display = 'none';
                        document.getElementById('sidebar-content').style.display = 'block';
                    } else {
                        this.hideUploadProgress();
                        alert('Upload failed: ' + result.error);
                    }
                } catch (error) {
                    this.hideUploadProgress();
                    alert('Upload error: ' + error.message);
                }
            }

            showUploadProgress(message, submessage) {
                const status = document.getElementById('uploadStatus');
                const messageEl = document.getElementById('uploadMessage');
                const submessageEl = document.getElementById('uploadSubmessage');
                const progressBar = document.getElementById('uploadProgressBar');
                const dropZone = document.getElementById('dropZone');

                messageEl.textContent = message;
                submessageEl.textContent = submessage;
                progressBar.style.width = '0%';
                status.classList.add('visible');
                dropZone.classList.add('loading');
            }

            updateUploadProgress(percentage, message, submessage) {
                const messageEl = document.getElementById('uploadMessage');
                const submessageEl = document.getElementById('uploadSubmessage');
                const progressBar = document.getElementById('uploadProgressBar');

                messageEl.textContent = message;
                submessageEl.textContent = submessage;
                progressBar.style.width = percentage + '%';
            }

            hideUploadProgress() {
                const status = document.getElementById('uploadStatus');
                const dropZone = document.getElementById('dropZone');

                status.classList.remove('visible');
                dropZone.classList.remove('loading');
            }

            processGraph() {
                this.fullGraph.nodes.forEach(node => {
                    node.connections = node.in_degree + node.out_degree;
                });

                this.displayStats();

                const topNodes = [...this.fullGraph.nodes]
                    .filter(node => node.type === 'class')
                    .sort((a, b) => b.connections - a.connections)
                    .slice(0, 5);

                topNodes.forEach(node => {
                    this.addNodeToGraph(node.id);
                    if (this.connectionDepth > 0) {
                        this.addConnectedNodes(node.id, this.connectionDepth, new Set([node.id]));
                    }
                });

                this.updateGraph();
            }

            displayStats() {
                const stats = this.fullGraph.stats;
                const statsHtml = \`
                    <div class="stat-card">
                        <div class="stat-value">\${stats.total_nodes.toLocaleString()}</div>
                        <div class="stat-label">Total Nodes</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${stats.total_edges.toLocaleString()}</div>
                        <div class="stat-label">Total Edges</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${stats.classes.toLocaleString()}</div>
                        <div class="stat-label">Classes</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${stats.methods.toLocaleString()}</div>
                        <div class="stat-label">Methods</div>
                    </div>
                \`;
                document.getElementById('stats').innerHTML = statsHtml;
            }

            updateGraphMetrics() {
                document.getElementById('displayedNodes').textContent = this.displayedNodes.size;
                document.getElementById('displayedEdges').textContent = this.displayedEdges.length;

                this.updateSelectedNodesList();

                const depths = this.displayedEdges.length > 0 ?
                    Math.ceil(Math.log2(this.displayedNodes.size + 1)) : 0;
                document.getElementById('maxDepth').textContent = depths;
            }

            updateSelectedNodesList() {
                document.getElementById('selectedCount').textContent = this.displayedNodes.size;

                const selectedNodes = Array.from(this.displayedNodes).map(id => {
                    return this.fullGraph.nodes.find(n => n.id === id);
                }).filter(node => node !== undefined);

                this.displayNodeList(selectedNodes, 'selectedNodes');
            }

            searchNodes(query) {
                const resultsContainer = document.getElementById('searchResults');

                if (!query) {
                    resultsContainer.innerHTML = '';
                    return;
                }

                let filtered = this.fullGraph.nodes.filter(node =>
                    node.label.toLowerCase().includes(query.toLowerCase()) ||
                    node.id.toLowerCase().includes(query.toLowerCase())
                );

                if (this.currentFilter !== 'all') {
                    filtered = filtered.filter(node => node.type === this.currentFilter);
                }

                filtered.sort((a, b) => b.connections - a.connections);

                if (filtered.length === 0) {
                    resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
                } else {
                    this.displayNodeList(filtered.slice(0, 50), 'searchResults');
                }
            }

            displayNodeList(nodes, containerId) {
                const container = document.getElementById(containerId);

                if (containerId === 'selectedNodes') {
                    container.innerHTML = nodes.map(node => \`
                        <div class="node-item in-graph"
                             data-id="\${node.id}"
                             onclick="explorer.centerViewOnNode('\${node.id}')"
                             title="\${this.escapeHtml(node.id)}">
                            <div class="node-info">
                                <div class="node-name">\${this.escapeHtml(node.label)}</div>
                                <div class="node-meta">
                                    \${node.file ? \`📁 \${node.file}\` : '📄 No file'}
                                </div>
                            </div>
                            <span class="node-badge badge-\${node.type}">\${node.type}</span>
                            <span class="remove-node" onclick="event.stopPropagation(); explorer.removeNodeFromGraph('\${node.id}');">✕</span>
                        </div>
                    \`).join('');
                    return;
                }

                if (containerId === 'nodeChildrenList') {
                    container.innerHTML = nodes.map(node => \`
                        <div class="node-item \${this.displayedNodes.has(node.id) ? 'in-graph' : ''}"
                             data-id="\${node.id}"
                             onclick="explorer.handleChildNodeClick('\${node.id}')"
                             title="\${this.escapeHtml(node.id)}">
                            <div class="node-info">
                                <div class="node-name">\${this.escapeHtml(node.label)}</div>
                                <div class="node-meta">
                                    \${node.file ? \`📁 \${node.file}\` : '📄 No file'}
                                    <span class="connection-count">🔗 \${node.connections}</span>
                                </div>
                            </div>
                            <span class="node-badge badge-\${node.type}">\${node.type}</span>
                        </div>
                    \`).join('');
                    return;
                }

                container.innerHTML = nodes.map(node => \`
                    <div class="node-item \${this.displayedNodes.has(node.id) ? 'in-graph' : ''}"
                         data-id="\${node.id}"
                         onclick="explorer.handleNodeListItemClick('\${node.id}')"
                         title="\${this.escapeHtml(node.id)}">
                        <div class="node-info">
                            <div class="node-name">\${this.escapeHtml(node.label)}</div>
                            <div class="node-meta">
                                \${node.file ? \`📁 \${node.file}\` : '📄 No file'}
                                <span class="connection-count">🔗 \${node.connections}</span>
                            </div>
                        </div>
                        <span class="node-badge badge-\${node.type}">\${node.type}</span>
                        \${this.displayedNodes.has(node.id) ? '<span class="remove-node" onclick="event.stopPropagation(); explorer.removeNodeFromGraph(' + JSON.stringify(node.id) + ');">✕</span>' : ''}
                    </div>
                \`).join('');
            }

            escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            showDepthNotification() {
                const badge = document.createElement('div');
                badge.style.cssText = \`
                    position: fixed;
                    top: 15px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    padding: 8px 16px;
                    border-radius: 16px;
                    font-weight: 600;
                    font-size: 12px;
                    z-index: 2000;
                    animation: slideDown 0.3s ease;
                \`;
                badge.textContent = \`Connection depth set to \${this.connectionDepth} level\${this.connectionDepth !== 1 ? 's' : ''}\`;
                document.body.appendChild(badge);

                setTimeout(() => badge.remove(), 2000);
            }

            applyDepthToGraph(oldDepth) {
                this.showDepthNotification();

                if (this.displayedNodes.size === 0) return;

                const currentNodes = Array.from(this.displayedNodes);
                this.displayedEdges = [];

                currentNodes.forEach(nodeId => {
                    this.updateEdgesForNode(nodeId);
                });

                if (this.connectionDepth > 0) {
                    const nodesToProcess = [...currentNodes];

                    nodesToProcess.forEach(nodeId => {
                        this.addConnectedNodes(nodeId, this.connectionDepth, new Set([nodeId]));
                    });
                }

                this.updateGraph();

                document.querySelectorAll('.node-item').forEach(el => {
                    const nodeId = el.dataset.id;
                    if (this.displayedNodes.has(nodeId)) {
                        el.classList.add('in-graph');
                    } else {
                        el.classList.remove('in-graph');
                    }
                });
            }

            toggleNode(nodeId) {
                if (this.displayedNodes.has(nodeId)) {
                    this.removeNodeFromGraph(nodeId);
                } else {
                    this.addNodeToGraph(nodeId);
                    if (this.connectionDepth > 0) {
                        this.addConnectedNodes(nodeId, this.connectionDepth, new Set([nodeId]));
                        this.updateGraph();
                        this.centerViewOnNode(nodeId);
                    }
                }

                document.querySelectorAll(\`[data-id="\${nodeId}"]\`).forEach(el => {
                    el.classList.toggle('in-graph');
                });

                this.updateGraphMetrics();
            }

            findConnectedComponents() {
                const adjList = new Map();
                this.displayedNodes.forEach(nodeId => {
                    adjList.set(nodeId, []);
                });

                this.displayedEdges.forEach(edge => {
                    if (this.displayedNodes.has(edge.source) && this.displayedNodes.has(edge.target)) {
                        if (!adjList.has(edge.source)) adjList.set(edge.source, []);
                        if (!adjList.has(edge.target)) adjList.set(edge.target, []);
                        adjList.get(edge.source).push(edge.target);
                        adjList.get(edge.target).push(edge.source);
                    }
                });

                const visited = new Set();
                const components = [];

                for (const nodeId of this.displayedNodes) {
                    if (!visited.has(nodeId)) {
                        const component = [];
                        const queue = [nodeId];
                        visited.add(nodeId);
                        component.push(nodeId);

                        while (queue.length > 0) {
                            const current = queue.shift();
                            const neighbors = adjList.get(current) || [];

                            for (const neighbor of neighbors) {
                                if (!visited.has(neighbor)) {
                                    visited.add(neighbor);
                                    queue.push(neighbor);
                                    component.push(neighbor);
                                }
                            }
                        }

                        components.push(component);
                    }
                }

                return components;
            }

            updateGraphWithClusters() {
                if (!this.g) {
                    console.warn('Graph not initialized yet');
                    return;
                }

                this.g.selectAll('.link').remove();
                this.g.selectAll('.node').remove();
                this.g.selectAll('.cluster').remove();

                if (this.currentClusters && this.currentClusters.length > 0) {
                    const clusterGroups = this.g.selectAll('.cluster')
                        .data(this.currentClusters)
                        .enter().append('g')
                        .attr('class', 'cluster')
                        .attr('transform', d => \`translate(\${d.x},\${d.y})\`);

                    clusterGroups.append('circle')
                        .attr('r', 30)
                        .attr('fill', 'rgba(102, 126, 234, 0.2)')
                        .attr('stroke', '#667eea')
                        .attr('stroke-width', 2);

                    clusterGroups.append('text')
                        .text(d => \`Cluster (\${d.nodes.length} nodes)\`)
                        .attr('dy', 5)
                        .attr('text-anchor', 'middle')
                        .attr('font-size', '10px')
                        .attr('font-weight', 'bold');

                    clusterGroups.on('click', (event, d) => {
                        this.expandCluster(d);
                    });

                    return;
                }

                const nodes = Array.from(this.displayedNodes).map(id => {
                    const node = this.fullGraph.nodes.find(n => n.id === id);
                    if (node) {
                        return {
                            ...node,
                            connections: node.connections || (node.in_degree + node.out_degree)
                        };
                    }
                    return {
                        id: id,
                        label: id,
                        type: 'unknown',
                        connections: 0,
                        in_degree: 0,
                        out_degree: 0
                    };
                }).filter(node => node !== null);

                const edges = this.displayedEdges.map(e => ({ ...e }));

                const link = this.g.selectAll('.link')
                    .data(edges)
                    .enter().append('line')
                    .attr('class', d => \`link \${d.type}\`)
                    .attr('stroke-width', d => Math.max(1, Math.min(3, d.weight || 1)));

                const node = this.g.selectAll('.node')
                    .data(nodes)
                    .enter().append('g')
                    .attr('class', 'node')
                    .on('click', (event, d) => {
                        this.showSelectedNodeInfo(d.id);
                        d3.select(event.currentTarget).raise();
                        this.handleGraphNodeClick(d);
                    })
                    .call(d3.drag()
                        .on('start', (event, d) => this.dragstarted(event, d))
                        .on('drag', (event, d) => this.dragged(event, d))
                        .on('end', (event, d) => this.dragended(event, d)));

                node.append('circle')
                    .attr('r', d => Math.min(25, 8 + Math.sqrt(d.connections)))
                    .attr('fill', d => {
                        if (d.type === 'class') return '#1976d2';
                        if (d.type === 'method') return '#7b1fa2';
                        if (d.type === 'function') return '#388e3c';
                        return '#666';
                    })
                    .attr('stroke', '#fff')
                    .attr('data-node-id', d => d.id);

                node.append('text')
                    .text(d => {
                        const label = d.label;
                        return label.length > 20 ? label.substring(0, 17) + '...' : label;
                    })
                    .attr('dy', 0.3);

                const tooltip = d3.select('#tooltip');
                node.on('mouseover', (event, d) => {
                    tooltip.style('opacity', 1)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 10) + 'px')
                        .html(\`
                            <strong>\${this.escapeHtml(d.label)}</strong><br>
                            <strong>Full:</strong> \${this.escapeHtml(d.id)}<br>
                            <strong>Type:</strong> \${d.type}<br>
                            <strong>File:</strong> \${d.file || 'N/A'}<br>
                            <strong>Line:</strong> \${d.line || 'N/A'}<br>
                            <strong>In:</strong> \${d.in_degree} | <strong>Out:</strong> \${d.out_degree}<br>
                            <strong>Total:</strong> \${d.connections} connections
                        \`);
                })
                .on('mouseout', () => {
                    tooltip.style('opacity', 0);
                });

                this.simulation.nodes(nodes);
                this.simulation.force('link').links(edges);

                this.simulation.alpha(1).restart();

                this.simulation.on('tick', () => {
                    link
                        .attr('x1', d => d.source.x)
                        .attr('y1', d => d.source.y)
                        .attr('x2', d => d.target.x)
                        .attr('y2', d => d.target.y);

                    node.attr('transform', d => \`translate(\${d.x},\${d.y})\`);
                });

                this.updateGraphMetrics();
            }

            expandCluster(cluster) {
                this.currentClusters = null;
                this.updateGraph();
                this.showNotification("Clusters expanded");
            }

            expandClusters() {
                this.currentClusters = null;
                this.updateGraph();
                this.showNotification("Clusters expanded");
            }

            addNodeToGraph(nodeId) {
                const node = this.fullGraph.nodes.find(n => n.id === nodeId);
                if (!node || this.displayedNodes.has(nodeId)) return;

                this.displayedNodes.add(nodeId);
                this.updateEdgesForNode(nodeId);
                this.updateGraph();
            }

            addConnectedNodes(nodeId, depth, visited) {
                if (depth <= 0) return;

                const connectedEdges = this.fullGraph.edges.filter(e =>
                    e.source === nodeId || e.target === nodeId
                );

                const connectedNodeMap = new Map();
                connectedEdges.forEach(edge => {
                    const otherId = edge.source === nodeId ? edge.target : edge.source;
                    if (!visited.has(otherId)) {
                        const otherNode = this.fullGraph.nodes.find(n => n.id === otherId);
                        if (otherNode && !connectedNodeMap.has(otherId)) {
                            connectedNodeMap.set(otherId, {
                                id: otherId,
                                node: otherNode,
                                edge: edge,
                                connections: otherNode ? otherNode.connections : 0
                            });
                        }
                    }
                });

                const connectedNodes = Array.from(connectedNodeMap.values())
                    .sort((a, b) => b.connections - a.connections)
                    .slice(0, this.connectionsPerLevel);

                connectedNodes.forEach(item => {
                    const otherId = item.id;
                    const edge = item.edge;

                    if (!this.displayedNodes.has(otherId)) {
                        this.displayedNodes.add(otherId);
                        this.updateEdgesForNode(otherId);
                    }

                    const sourceDisplayed = this.displayedNodes.has(edge.source);
                    const targetDisplayed = this.displayedNodes.has(edge.target);

                    if (sourceDisplayed && targetDisplayed) {
                        const edgeExists = this.displayedEdges.some(e =>
                            e.source === edge.source && e.target === edge.target && e.type === edge.type
                        );

                        if (!edgeExists) {
                            this.displayedEdges.push({...edge});
                        }
                    }

                    if (depth > 1) {
                        const newVisited = new Set(visited);
                        newVisited.add(otherId);
                        this.addConnectedNodes(otherId, depth - 1, newVisited);
                    }
                });
            }

            updateAllEdges() {
                this.displayedEdges = [];

                this.fullGraph.edges.forEach(edge => {
                    if (this.displayedNodes.has(edge.source) && this.displayedNodes.has(edge.target)) {
                        this.displayedEdges.push(edge);
                    }
                });
            }

            removeNodeFromGraph(nodeId) {
                this.displayedNodes.delete(nodeId);
                this.updateAllEdges();
                this.updateGraph();
            }

            updateEdgesForNode(nodeId) {
                const newEdges = this.fullGraph.edges.filter(e =>
                    (e.source === nodeId && this.displayedNodes.has(e.target)) ||
                    (e.target === nodeId && this.displayedNodes.has(e.source))
                );

                newEdges.forEach(edge => {
                    const edgeExists = this.displayedEdges.some(e =>
                        e.source === edge.source && e.target === edge.target && e.type === edge.type
                    );

                    if (!edgeExists) {
                        this.displayedEdges.push({...edge});
                    }
                });
            }

            initializeGraph() {
                const svg = d3.select('#graph-svg');
                const container = svg.node().parentElement;

                const width = container.clientWidth || 800;
                const height = container.clientHeight || 600;

                svg.attr('viewBox', [0, 0, width, height])
                   .attr('width', width)
                   .attr('height', height);

                svg.selectAll("*").remove();

                this.g = svg.append('g');
                this.width = width;
                this.height = height;

                this.zoom = d3.zoom()
                    .scaleExtent([0.1, 10])
                    .on('zoom', (event) => {
                        this.g.attr('transform', event.transform);
                    });

                svg.call(this.zoom);

                this.simulation = d3.forceSimulation()
                    .force('link', d3.forceLink().id(d => d.id).distance(80))
                    .force('charge', d3.forceManyBody().strength(-400))
                    .force('center', d3.forceCenter(width / 2, height / 2))
                    .force('collision', d3.forceCollide().radius(40));

                console.log('Graph initialized with dimensions:', width, 'x', height);
            }

            updateGraph() {
                if (!this.g) {
                    console.warn('Graph not initialized yet');
                    return;
                }

                const nodes = Array.from(this.displayedNodes).map(id => {
                    const node = this.fullGraph.nodes.find(n => n.id === id);
                    if (node) {
                        return {
                            ...node,
                            connections: node.connections || (node.in_degree + node.out_degree)
                        };
                    }
                    return {
                        id: id,
                        label: id,
                        type: 'unknown',
                        connections: 0,
                        in_degree: 0,
                        out_degree: 0
                    };
                }).filter(node => node !== null);

                const edges = this.displayedEdges.map(e => ({ ...e }));

                this.g.selectAll('.link').remove();
                this.g.selectAll('.node').remove();

                const link = this.g.selectAll('.link')
                    .data(edges)
                    .enter().append('line')
                    .attr('class', d => \`link \${d.type}\`)
                    .attr('stroke-width', d => Math.max(1, Math.min(3, d.weight || 1)));

                const node = this.g.selectAll('.node')
                    .data(nodes)
                    .enter().append('g')
                    .attr('class', 'node')
                    .on('click', (event, d) => {
                        this.showSelectedNodeInfo(d.id);
                        d3.select(event.currentTarget).raise();
                        this.handleGraphNodeClick(d);
                    })
                    .call(d3.drag()
                        .on('start', (event, d) => this.dragstarted(event, d))
                        .on('drag', (event, d) => this.dragged(event, d))
                        .on('end', (event, d) => this.dragended(event, d)));

                node.append('circle')
                    .attr('r', d => Math.min(25, 8 + Math.sqrt(d.connections)))
                    .attr('fill', d => {
                        if (d.type === 'class') return '#1976d2';
                        if (d.type === 'method') return '#7b1fa2';
                        if (d.type === 'function') return '#388e3c';
                        return '#666';
                    })
                    .attr('stroke', '#fff')
                    .attr('data-node-id', d => d.id);

                node.append('text')
                    .text(d => {
                        const label = d.label;
                        return label.length > 20 ? label.substring(0, 17) + '...' : label;
                    })
                    .attr('dy', 0.3);

                const tooltip = d3.select('#tooltip');
                node.on('mouseover', (event, d) => {
                    tooltip.style('opacity', 1)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 10) + 'px')
                        .html(\`
                            <strong>\${this.escapeHtml(d.label)}</strong><br>
                            <strong>Full:</strong> \${this.escapeHtml(d.id)}<br>
                            <strong>Type:</strong> \${d.type}<br>
                            <strong>File:</strong> \${d.file || 'N/A'}<br>
                            <strong>Line:</strong> \${d.line || 'N/A'}<br>
                            <strong>In:</strong> \${d.in_degree} | <strong>Out:</strong> \${d.out_degree}<br>
                            <strong>Total:</strong> \${d.connections} connections
                        \`);
                })
                .on('mouseout', () => {
                    tooltip.style('opacity', 0);
                });

                this.simulation.nodes(nodes);
                this.simulation.force('link').links(edges);

                this.simulation.alpha(1).restart();

                this.simulation.on('tick', () => {
                    link
                        .attr('x1', d => d.source.x)
                        .attr('y1', d => d.source.y)
                        .attr('x2', d => d.target.x)
                        .attr('y2', d => d.target.y);

                    node.attr('transform', d => \`translate(\${d.x},\${d.y})\`);
                });

                this.updateGraphMetrics();
            }

            dragstarted(event, d) {
               if (!event.active) {
                   this.simulation.alphaTarget(0.3).restart();
               }
               d.fx = d.x;
               d.fy = d.y;
           }

            dragged(event, d) {
                d.fx = event.x;
                d.fy = event.y;
            }

            dragended(event, d) {
               if (!event.active) {
                   this.simulation.alphaTarget(0);
               }
               d.fx = null;
               d.fy = null;
           }

            clearGraph() {
                this.displayedNodes.clear();
                this.displayedEdges = [];
                this.updateGraph();

                document.querySelectorAll('.node-item').forEach(el => {
                    el.classList.remove('in-graph');
                });
            }

            fitView() {
                if (!this.g || !this.g.node()) {
                    console.warn('Graph not ready for fit view');
                    return;
                }

                const bounds = this.g.node().getBBox();
                if (bounds.width === 0 || bounds.height === 0) {
                    console.warn('No content to fit');
                    return;
                }

                const svg = d3.select('#graph-svg');
                const container = svg.node().parentElement;
                const width = container.clientWidth || this.width;
                const height = container.clientHeight || this.height;

                const midX = bounds.x + bounds.width / 2;
                const midY = bounds.y + bounds.height / 2;

                const scale = 0.8 / Math.max(bounds.width / width, bounds.height / height);
                const translate = [width / 2 - scale * midX, height / 2 - scale * midY];

                svg.transition().duration(750).call(
                    this.zoom.transform,
                    d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
                );
            }

            reduceDistances() {
               if (!this.simulation) return;

               const components = this.findConnectedComponents();

               if (components.length > 1) {
                   this.reduceInterComponentDistances(components);
               } else {
                   this.showNotification("All nodes are connected");
               }
           }

           reduceInterComponentDistances(components) {
               if (!this.simulation) return;

               const linkForce = this.simulation.force('link');
               const chargeForce = this.simulation.force('charge');
               const collisionForce = this.simulation.force('collision');

               const currentLinkDistance = linkForce.distance();
               const currentChargeStrength = chargeForce.strength();

               const actualLinkDistance = typeof currentLinkDistance === 'function' ?
                   currentLinkDistance({source: {}, target: {}}) : currentLinkDistance;
               const actualChargeStrength = typeof currentChargeStrength === 'function' ?
                   currentChargeStrength({}) : currentChargeStrength;

               if (actualLinkDistance <= 20) {
                   this.showNotification("Close enough");
                   return;
               }

               const newLinkDistance = Math.max(20, actualLinkDistance * 0.75);
               const newChargeStrength = Math.max(-1000, actualChargeStrength * 0.75);

               linkForce.distance(newLinkDistance);
               chargeForce.strength(newChargeStrength);

               if (collisionForce) {
                   const newCollisionRadius = Math.min(40, Math.max(15, newLinkDistance * 0.5));
                   collisionForce.radius(newCollisionRadius);
               }

               this.simulation.alpha(0.3).restart();

               this.showNotification(\`Components clustered (\${components.length} groups)\`);
           }

           showNotification(message) {
               const existing = document.querySelector('.distance-notification');
               if (existing) existing.remove();

               const notification = document.createElement('div');
               notification.className = 'distance-notification';
               notification.style.cssText = \`
                   position: fixed;
                   top: 20px;
                   left: 50%;
                   transform: translateX(-50%);
                   background: linear-gradient(135deg, #667eea, #764ba2);
                   color: white;
                   padding: 8px 16px;
                   border-radius: 16px;
                   font-weight: 600;
                   font-size: 12px;
                   z-index: 2000;
                   animation: slideDown 0.3s ease;
               \`;
               notification.textContent = message;
               document.body.appendChild(notification);

               setTimeout(() => {
                   notification.remove();
               }, 2000);
           }

           expandDistances() {
               if (!this.simulation) return;

               const linkForce = this.simulation.force('link');
               const chargeForce = this.simulation.force('charge');
               const collisionForce = this.simulation.force('collision');

               const currentLinkDistance = linkForce.distance();
               const currentChargeStrength = chargeForce.strength();

               const actualLinkDistance = typeof currentLinkDistance === 'function' ?
                   currentLinkDistance({source: {}, target: {}}) : currentLinkDistance;
               const actualChargeStrength = typeof currentChargeStrength === 'function' ?
                   currentChargeStrength({}) : currentChargeStrength;

               if (actualLinkDistance >= 200) {
                   this.showNotification("Far enough");
                   return;
               }

               const newLinkDistance = Math.min(200, actualLinkDistance * 1.15);
               const newChargeStrength = Math.min(-100, actualChargeStrength * 1.15);

               linkForce.distance(newLinkDistance);
               chargeForce.strength(newChargeStrength);

               if (collisionForce) {
                   const newCollisionRadius = Math.min(40, Math.max(15, newLinkDistance * 0.5));
                   collisionForce.radius(newCollisionRadius);
               }

               this.simulation.alpha(0.3).restart();

               if (newLinkDistance >= 200) {
                   this.showNotification("Far enough");
               } else {
                   this.showNotification(\`Distance increased to \${Math.round(newLinkDistance)}px\`);
               }
           }

            handleNodeClick(nodeId) {
                if (this.displayedNodes.has(nodeId)) {
                    this.centerViewOnNode(nodeId);
                    return;
                }

                this.showTopConnections(nodeId);
            }

            showTopConnections(nodeId) {
                const node = this.fullGraph.nodes.find(n => n.id === nodeId);
                if (!node) return;

                const connectedEdges = this.fullGraph.edges.filter(e =>
                    e.source === nodeId || e.target === nodeId
                );

                const connectedNodeMap = new Map();
                connectedEdges.forEach(edge => {
                    const otherId = edge.source === nodeId ? edge.target : edge.source;
                    const otherNode = this.fullGraph.nodes.find(n => n.id === otherId);
                    if (otherNode && !connectedNodeMap.has(otherId)) {
                        connectedNodeMap.set(otherId, otherNode);
                    }
                });

                const connectedNodes = Array.from(connectedNodeMap.values())
                    .sort((a, b) => b.connections - a.connections)
                    .slice(0, this.connectionsPerLevel);

                this.showConnectionSelector(nodeId, connectedNodes);
            }

            showConnectionSelector(nodeId, connectedNodes) {
                const selector = document.createElement('div');
                selector.style.cssText = \`
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
                    z-index: 3000;
                    min-width: 300px;
                    max-height: 80vh;
                    overflow: hidden;
                \`;

                const header = document.createElement('div');
                header.style.cssText = \`
                    padding: 14px;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    font-weight: 600;
                    font-size: 14px;
                \`;
                header.textContent = 'Top Connections - Select to add';

                const closeBtn = document.createElement('button');
                closeBtn.textContent = '×';
                closeBtn.style.cssText = \`
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                \`;
                closeBtn.onclick = () => document.body.removeChild(selector);
                header.appendChild(closeBtn);

                const list = document.createElement('div');
                list.style.cssText = \`
                    max-height: 50vh;
                    overflow-y: auto;
                \`;

                const mainNodeItem = document.createElement('div');
                mainNodeItem.style.cssText = \`
                    padding: 10px 14px;
                    border-bottom: 1px solid #eee;
                    cursor: pointer;
                    transition: all 0.2s;
                \`;
                mainNodeItem.innerHTML = \`
                    <div style="font-weight: 600; font-size: 13px;">\${this.escapeHtml(nodeId)}</div>
                    <div style="font-size: 11px; color: #666;">Main node - Click to add</div>
                \`;
                mainNodeItem.onclick = () => {
                    this.addNodeToGraph(nodeId);
                    if (this.connectionDepth > 0) {
                        this.addConnectedNodes(nodeId, this.connectionDepth, new Set([nodeId]));
                    }
                    this.updateGraph();
                    this.centerViewOnNode(nodeId);
                    document.body.removeChild(selector);
                };
                mainNodeItem.onmouseover = () => mainNodeItem.style.background = '#f0f0f0';
                mainNodeItem.onmouseout = () => mainNodeItem.style.background = 'white';
                list.appendChild(mainNodeItem);

                connectedNodes.forEach(connectedNode => {
                    const item = document.createElement('div');
                    item.style.cssText = \`
                        padding: 10px 14px;
                        border-bottom: 1px solid #eee;
                        cursor: pointer;
                        transition: all 0.2s;
                    \`;
                    item.innerHTML = \`
                        <div style="font-weight: 600; font-size: 13px;">\${this.escapeHtml(connectedNode.label)}</div>
                        <div style="font-size: 11px; color: #666;">
                            \${connectedNode.file ? \`📁 \${connectedNode.file}\` : '📄 No file'}
                            <span style="margin-left: 8px;">🔗 \${connectedNode.connections}</span>
                        </div>
                    \`;
                    item.onclick = () => {
                        this.addNodeToGraph(connectedNode.id);
                        if (this.connectionDepth > 0) {
                            this.addConnectedNodes(connectedNode.id, this.connectionDepth, new Set([connectedNode.id]));
                        }
                        this.updateGraph();
                        this.centerViewOnNode(connectedNode.id);
                        document.body.removeChild(selector);
                    };
                    item.onmouseover = () => item.style.background = '#f0f0f0';
                    item.onmouseout = () => item.style.background = 'white';
                    list.appendChild(item);
                });

                selector.appendChild(header);
                selector.appendChild(list);
                document.body.appendChild(selector);
            }

            centerViewOnNode(nodeId) {
                const node = this.simulation.nodes().find(n => n.id === nodeId);
                if (!node) return;

                const svg = d3.select('#graph-svg');
                const container = svg.node().parentElement;
                const width = container.clientWidth || this.width;
                const height = container.clientHeight || this.height;

                const scale = 1;
                const translate = [width / 2 - node.x * scale, height / 2 - node.y * scale];

                svg.transition().duration(750).call(
                    this.zoom.transform,
                    d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
                );

                const nodeElement = d3.select(\`circle[data-node-id="\${nodeId}"]\`).node();
                if (nodeElement) {
                    const originalRadius = parseFloat(d3.select(nodeElement).attr('r')) || 8;

                    d3.select(nodeElement)
                        .transition()
                        .duration(300)
                        .attr('r', originalRadius * 2.5)
                        .transition()
                        .duration(300)
                        .attr('r', originalRadius * 3.0)
                        .transition()
                        .duration(300)
                        .attr('r', originalRadius * 2.5)
                        .transition()
                        .duration(300)
                        .attr('r', originalRadius);
                }
            }

            handleNodeListItemClick(nodeId) {
                this.showSelectedNodeInfo(nodeId);

                if (this.displayedNodes.has(nodeId)) {
                    this.centerViewOnNode(nodeId);
                    return;
                }

                this.showTopConnections(nodeId);
            }

            handleGraphNodeClick(node) {
                this.showNodeChildrenInPanel(node.id);
                this.centerViewOnNode(node.id);
            }

            showSelectedNodeInfo(nodeId) {
                let notification = document.querySelector('.selected-node-notification');
                if (!notification) {
                    notification = document.createElement('div');
                    notification.className = 'selected-node-notification';
                    notification.style.cssText = \`
                        position: fixed;
                        top: 50px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: rgba(0, 0, 0, 0.8);
                        color: white;
                        padding: 8px 16px;
                        border-radius: 8px;
                        font-size: 12px;
                        z-index: 1999;
                        backdrop-filter: blur(4px);
                    \`;
                    document.body.appendChild(notification);
                }

                const node = this.fullGraph.nodes.find(n => n.id === nodeId);
                if (node) {
                    notification.textContent = \`Selected Node: \${node.label || nodeId}\`;
                } else {
                    notification.textContent = \`Selected Node: \${nodeId}\`;
                }

                if (this.selectedNodeTimeout) {
                    clearTimeout(this.selectedNodeTimeout);
                }

                this.selectedNodeTimeout = setTimeout(() => {
                    if (notification) {
                        notification.remove();
                    }
                }, 2000);
            }

            handleChildNodeClick(nodeId) {
                if (this.displayedNodes.has(nodeId)) {
                    this.centerViewOnNode(nodeId);
                    return;
                }

                this.addNodeToGraph(nodeId);

                if (this.connectionDepth > 0) {
                    this.addConnectedNodes(nodeId, this.connectionDepth, new Set([nodeId]));
                    this.updateGraph();
                    this.centerViewOnNode(nodeId);
                }

                document.querySelectorAll('.node-item').forEach(el => {
                    const id = el.dataset.id;
                    if (this.displayedNodes.has(id)) {
                        el.classList.add('in-graph');
                    } else {
                        el.classList.remove('in-graph');
                    }
                });

                if (this.currentChildrenParentId) {
                    this.showNodeChildrenInPanel(this.currentChildrenParentId);
                }

                this.updateGraphMetrics();
            }

            showNodeChildrenInPanel(nodeId) {
                const node = this.fullGraph.nodes.find(n => n.id === nodeId);
                if (!node) return;

                const connectedEdges = this.fullGraph.edges.filter(e =>
                    e.source === nodeId || e.target === nodeId
                );

                const connectedNodeMap = new Map();
                connectedEdges.forEach(edge => {
                    const otherId = edge.source === nodeId ? edge.target : edge.source;
                    const otherNode = this.fullGraph.nodes.find(n => n.id === otherId);
                    if (otherNode && !connectedNodeMap.has(otherId)) {
                        connectedNodeMap.set(otherId, otherNode);
                    }
                });

                const connectedNodes = Array.from(connectedNodeMap.values())
                    .sort((a, b) => b.connections - a.connections);

                this.displayNodeChildren(connectedNodes, nodeId);
            }

            displayNodeChildren(nodes, parentNodeId) {
                const parentNode = this.fullGraph.nodes.find(n => n.id === parentNodeId);
                if (!parentNode) return;

                document.getElementById('childrenCount').textContent = nodes.length;

                const childrenTitle = document.querySelector('#nodeChildrenSection h2');
                if (childrenTitle) {
                    childrenTitle.innerHTML = \`👶 Children of \${this.escapeHtml(parentNode.label || parentNode.id)} <span class="section-badge" id="childrenCount">\${nodes.length}</span>\`;
                }

                document.getElementById('nodeChildrenSection').style.display = 'block';

                this.currentConnections = nodes;
                this.currentChildrenParentId = parentNodeId;

                this.displayNodeList(nodes, 'nodeChildrenList');
            }

            displayFilteredConnections(nodes) {
                const container = document.getElementById('nodeChildrenList');
                container.innerHTML = nodes.map(node => \`
                    <div class="node-item \${this.displayedNodes.has(node.id) ? 'in-graph' : ''}"
                         data-id="\${node.id}"
                         onclick="explorer.handleChildNodeClick('\${node.id}')"
                         title="\${this.escapeHtml(node.id)}">
                        <div class="node-info">
                            <div class="node-name">\${this.escapeHtml(node.label)}</div>
                            <div class="node-meta">
                                \${node.file ? \`📁 \${node.file}\` : '📄 No file'}
                                <span class="connection-count">🔗 \${node.connections}</span>
                            </div>
                        </div>
                        <span class="node-badge badge-\${node.type}">\${node.type}</span>
                        \${this.displayedNodes.has(node.id) ? '<span class="remove-node" onclick="event.stopPropagation(); explorer.removeNodeFromGraph(' + JSON.stringify(node.id) + ');">✕</span>' : ''}
                    </div>
                \`).join('');
            }

            filterConnections(query) {
                if (!this.currentConnections) return;

                const filtered = query ?
                    this.currentConnections.filter(node =>
                        node.label.toLowerCase().includes(query.toLowerCase()) ||
                        node.id.toLowerCase().includes(query.toLowerCase())
                    ) : this.currentConnections;

                this.displayFilteredConnections(filtered);
            }

            filterChildren(query) {
                const childrenSection = document.getElementById('nodeChildrenSection');
                if (!childrenSection || childrenSection.style.display === 'none') return;

                const childNodes = Array.from(this.displayedNodes).map(id => {
                    return this.fullGraph.nodes.find(n => n.id === id);
                }).filter(node => node !== undefined);

                const filtered = query ?
                    childNodes.filter(node =>
                        node.label.toLowerCase().includes(query.toLowerCase()) ||
                        node.id.toLowerCase().includes(query.toLowerCase())
                    ) : childNodes;

                this.displayNodeList(filtered, 'nodeChildrenList');
            }

            resetToDefaultView() {
                this.displayedNodes.clear();
                this.displayedEdges = [];

                document.getElementById('depthInput').value = 2;
                document.getElementById('connectionsInput').value = 5;
                this.connectionDepth = 2;
                this.connectionsPerLevel = 5;

                const topNodes = [...this.fullGraph.nodes]
                    .filter(node => node.type === 'class')
                    .sort((a, b) => b.connections - a.connections)
                    .slice(0, 5);

                topNodes.forEach(node => {
                    this.addNodeToGraph(node.id);
                    if (this.connectionDepth > 0) {
                        this.addConnectedNodes(node.id, this.connectionDepth, new Set([node.id]));
                    }
                });

                this.updateGraph();

                document.querySelectorAll('.node-item').forEach(el => {
                    const nodeId = el.dataset.id;
                    if (this.displayedNodes.has(nodeId)) {
                        el.classList.add('in-graph');
                    } else {
                        el.classList.remove('in-graph');
                    }
                });

                const childrenSection = document.getElementById('nodeChildrenSection');
                if (childrenSection) {
                    childrenSection.style.display = 'none';
                    const childrenTitle = document.querySelector('#nodeChildrenSection h2');
                    if (childrenTitle) {
                        childrenTitle.innerHTML = \`👶 Children of Selected Node <span class="section-badge" id="childrenCount">0</span>\`;
                    }
                }
            }

            // Graph filter methods
            filterGraphNodes(query) {
                // Clear previous filter
                this.clearGraphFilter();

                if (!query) return;

                // Find nodes that match the filter
                const filteredNodeIds = new Set();

                Array.from(this.displayedNodes).forEach(nodeId => {
                    const node = this.fullGraph.nodes.find(n => n.id === nodeId);
                    if (node && (
                        node.label.toLowerCase().includes(query.toLowerCase()) ||
                        node.id.toLowerCase().includes(query.toLowerCase()) ||
                        node.type.toLowerCase().includes(query.toLowerCase())
                    )) {
                        filteredNodeIds.add(nodeId);
                    }
                });

                // Mark filtered nodes in the sidebar
                document.querySelectorAll('#selectedNodes .node-item').forEach(item => {
                    const nodeId = item.dataset.id;
                    if (filteredNodeIds.has(nodeId)) {
                        item.classList.add('filtered');
                    }
                });

                // Store filtered nodes for deletion
                this.filteredNodeIds = filteredNodeIds;

                // Show notification
                this.showNotification('Found ' + filteredNodeIds.size + ' matching nodes');
            }

            deleteFilteredNodes() {
                if (!this.filteredNodeIds || this.filteredNodeIds.size === 0) {
                    this.showNotification('No nodes to delete');
                    return;
                }

                const deleteCount = this.filteredNodeIds.size;

                // Remove each filtered node
                this.filteredNodeIds.forEach(nodeId => {
                    this.removeNodeFromGraph(nodeId);
                });

                // Clear filter
                this.clearGraphFilter();

                // Update UI
                document.querySelectorAll('.node-item').forEach(el => {
                    const nodeId = el.dataset.id;
                    if (this.displayedNodes.has(nodeId)) {
                        el.classList.add('in-graph');
                    } else {
                        el.classList.remove('in-graph');
                    }
                });

                // Clear filter input
                const graphFilterInput = document.getElementById('graphFilterInput');
                if (graphFilterInput) {
                    graphFilterInput.value = '';
                }

                this.showNotification('Deleted ' + deleteCount + ' nodes');
            }

            clearGraphFilter() {
                // Clear visual filter indicators
                document.querySelectorAll('.node-item.filtered').forEach(item => {
                    item.classList.remove('filtered');
                });

                // Clear stored filtered nodes
                this.filteredNodeIds = new Set();
            }

            async loadDemoData() {
                // Show loading state
                this.showUploadProgress('Loading Demo Data...', 'Preparing sample graph data...');

                try {
                    this.updateUploadProgress(30, 'Processing demo data...', 'Building graph structure...');

                    // Use embedded sample data
                    const graphData = this.getSampleGraphData();

                    this.updateUploadProgress(70, 'Initializing visualization...', 'Setting up graph components...');

                    // Simulate processing time for better UX
                    await new Promise(resolve => setTimeout(resolve, 800));

                    this.fullGraph = graphData;
                    this.processGraph();

                    this.updateUploadProgress(100, 'Demo loaded successfully!', 'Ready to explore sample data');
                    await new Promise(resolve => setTimeout(resolve, 300));

                    // Hide loading and show content
                    this.hideUploadProgress();
                    document.getElementById('dropZone').style.display = 'none';
                    document.getElementById('sidebar-content').style.display = 'block';

                } catch (error) {
                    this.hideUploadProgress();
                    alert('Failed to load demo data: ' + error.message);
                }
            }

            getSampleGraphData() {
                return {
                    "nodes": [
                        {
                            "id": "App\\\\Controller\\\\UserController",
                            "label": "UserController",
                            "type": "class",
                            "file": "src/Controller/UserController.php",
                            "line": 15,
                            "in_degree": 3,
                            "out_degree": 5
                        },
                        {
                            "id": "App\\\\Service\\\\UserService",
                            "label": "UserService",
                            "type": "class",
                            "file": "src/Service/UserService.php",
                            "line": 12,
                            "in_degree": 2,
                            "out_degree": 4
                        },
                        {
                            "id": "App\\\\Repository\\\\UserRepository",
                            "label": "UserRepository",
                            "type": "class",
                            "file": "src/Repository/UserRepository.php",
                            "line": 8,
                            "in_degree": 1,
                            "out_degree": 3
                        },
                        {
                            "id": "App\\\\Entity\\\\User",
                            "label": "User",
                            "type": "class",
                            "file": "src/Entity/User.php",
                            "line": 10,
                            "in_degree": 4,
                            "out_degree": 2
                        },
                        {
                            "id": "App\\\\Controller\\\\UserController::getUsers",
                            "label": "getUsers",
                            "type": "method",
                            "file": "src/Controller/UserController.php",
                            "line": 25,
                            "in_degree": 1,
                            "out_degree": 2
                        },
                        {
                            "id": "App\\\\Controller\\\\UserController::createUser",
                            "label": "createUser",
                            "type": "method",
                            "file": "src/Controller/UserController.php",
                            "line": 45,
                            "in_degree": 0,
                            "out_degree": 3
                        },
                        {
                            "id": "App\\\\Service\\\\UserService::findAll",
                            "label": "findAll",
                            "type": "method",
                            "file": "src/Service/UserService.php",
                            "line": 20,
                            "in_degree": 2,
                            "out_degree": 1
                        },
                        {
                            "id": "App\\\\Service\\\\UserService::create",
                            "label": "create",
                            "type": "method",
                            "file": "src/Service/UserService.php",
                            "line": 35,
                            "in_degree": 1,
                            "out_degree": 2
                        },
                        {
                            "id": "App\\\\Repository\\\\UserRepository::findAll",
                            "label": "findAll",
                            "type": "method",
                            "file": "src/Repository/UserRepository.php",
                            "line": 18,
                            "in_degree": 1,
                            "out_degree": 0
                        },
                        {
                            "id": "App\\\\Repository\\\\UserRepository::save",
                            "label": "save",
                            "type": "method",
                            "file": "src/Repository/UserRepository.php",
                            "line": 30,
                            "in_degree": 2,
                            "out_degree": 0
                        }
                    ],
                    "edges": [
                        {
                            "source": "App\\\\Controller\\\\UserController",
                            "target": "App\\\\Service\\\\UserService",
                            "type": "method_call",
                            "weight": 2
                        },
                        {
                            "source": "App\\\\Controller\\\\UserController",
                            "target": "App\\\\Entity\\\\User",
                            "type": "instantiates",
                            "weight": 1
                        },
                        {
                            "source": "App\\\\Service\\\\UserService",
                            "target": "App\\\\Repository\\\\UserRepository",
                            "type": "method_call",
                            "weight": 3
                        },
                        {
                            "source": "App\\\\Service\\\\UserService",
                            "target": "App\\\\Entity\\\\User",
                            "type": "instantiates",
                            "weight": 1
                        },
                        {
                            "source": "App\\\\Repository\\\\UserRepository",
                            "target": "App\\\\Entity\\\\User",
                            "type": "extends",
                            "weight": 1
                        },
                        {
                            "source": "App\\\\Controller\\\\UserController::getUsers",
                            "target": "App\\\\Service\\\\UserService::findAll",
                            "type": "method_call",
                            "weight": 1
                        },
                        {
                            "source": "App\\\\Controller\\\\UserController::createUser",
                            "target": "App\\\\Service\\\\UserService::create",
                            "type": "method_call",
                            "weight": 1
                        },
                        {
                            "source": "App\\\\Controller\\\\UserController::createUser",
                            "target": "App\\\\Entity\\\\User",
                            "type": "instantiates",
                            "weight": 1
                        },
                        {
                            "source": "App\\\\Service\\\\UserService::findAll",
                            "target": "App\\\\Repository\\\\UserRepository::findAll",
                            "type": "method_call",
                            "weight": 1
                        },
                        {
                            "source": "App\\\\Service\\\\UserService::create",
                            "target": "App\\\\Repository\\\\UserRepository::save",
                            "type": "method_call",
                            "weight": 1
                        },
                        {
                            "source": "App\\\\Service\\\\UserService::create",
                            "target": "App\\\\Entity\\\\User",
                            "type": "instantiates",
                            "weight": 1
                        },
                        {
                            "source": "App\\\\Repository\\\\UserRepository::save",
                            "target": "App\\\\Entity\\\\User",
                            "type": "static_call",
                            "weight": 1
                        }
                    ],
                    "stats": {
                        "total_nodes": 10,
                        "total_edges": 12,
                        "classes": 4,
                        "methods": 6,
                        "functions": 0
                    }
                };
            }
        }
        }

        const explorer = new GraphExplorer();
    </script>
</body>
</html>`;
}
