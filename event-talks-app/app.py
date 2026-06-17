import os
import requests
import feedparser
from flask import Flask, jsonify, render_template

app = Flask(__name__)

# Fallback parser using ElementTree if feedparser is not working
def parse_feed_fallback(url):
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        import xml.etree.ElementTree as ET
        root = ET.fromstring(response.content)
        
        # Atom feed namespace
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = []
        # Support both RSS and Atom
        if root.tag.endswith('feed'):  # Atom
            for entry in root.findall('atom:entry', ns):
                title_el = entry.find('atom:title', ns)
                updated_el = entry.find('atom:updated', ns) or entry.find('atom:published', ns)
                content_el = entry.find('atom:content', ns) or entry.find('atom:summary', ns)
                link_el = entry.find('atom:link', ns)
                
                title = title_el.text if title_el is not None else "No Title"
                date = updated_el.text if updated_el is not None else ""
                content = content_el.text if content_el is not None else ""
                link = link_el.attrib.get('href', '') if link_el is not None else ""
                
                entries.append({
                    'title': title,
                    'date': date,
                    'content': content,
                    'link': link
                })
        else: # RSS
            for item in root.findall('.//item'):
                title_el = item.find('title')
                date_el = item.find('pubDate') or item.find('date')
                desc_el = item.find('description')
                link_el = item.find('link')
                
                title = title_el.text if title_el is not None else "No Title"
                date = date_el.text if date_el is not None else ""
                content = desc_el.text if desc_el is not None else ""
                link = link_el.text if link_el is not None else ""
                
                entries.append({
                    'title': title,
                    'date': date,
                    'content': content,
                    'link': link
                })
        return entries
    except Exception as e:
        print(f"Fallback parser failed: {e}")
        return []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    feed_url = 'https://docs.cloud.google.com/feeds/bigquery-release-notes.xml'
    try:
        # Try parsing with feedparser first
        feed = feedparser.parse(feed_url)
        if feed.entries:
            entries = []
            for entry in feed.entries:
                # Extract content
                content = ""
                if 'content' in entry:
                    content = entry.content[0].value
                elif 'summary' in entry:
                    content = entry.summary
                elif 'description' in entry:
                    content = entry.description
                
                # Extract date
                date_str = ""
                if 'updated' in entry:
                    date_str = entry.updated
                elif 'published' in entry:
                    date_str = entry.published
                
                entries.append({
                    'title': entry.get('title', 'No Title'),
                    'date': date_str,
                    'content': content,
                    'link': entry.get('link', '')
                })
            return jsonify({'success': True, 'data': entries})
        else:
            # Fallback to manual parsing if feedparser returned empty/failed
            fallback_data = parse_feed_fallback(feed_url)
            if fallback_data:
                return jsonify({'success': True, 'data': fallback_data})
            return jsonify({'success': False, 'error': 'Failed to parse feed'}), 500
    except Exception as e:
        # Fallback to manual parsing on exception
        fallback_data = parse_feed_fallback(feed_url)
        if fallback_data:
            return jsonify({'success': True, 'data': fallback_data})
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
