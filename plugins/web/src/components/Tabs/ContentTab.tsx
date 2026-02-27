import React from 'react';
import { HelpCircle } from 'lucide-react';
import { PageDetails } from '../api';

export const ContentTab = ({ details }: { details: PageDetails }) => {
    const { content, identity } = details;

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Content Analysis</h2>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <ContentRow
                        label="Page Title"
                        value={identity.title || 'Not Extracted'}
                        meta={identity.title ? `${identity.title.length} chars` : undefined}
                        tooltip="The <title> tag value. Critical for relevance and click-through rates."
                    />
                    <ContentRow
                        label="Meta Description"
                        value={identity.metaDescription || 'Not Extracted'}
                        meta={identity.metaDescription ? `${identity.metaDescription.length} chars` : undefined}
                        tooltip="The <meta name='description'> tag. influences snippets in search results."
                    />
                    <ContentRow
                        label="H1 Heading"
                        value={identity.h1 || 'Not Extracted'}
                        tooltip="The primary heading of the page structure."
                    />
                </div>

                <div className="space-y-6">
                    <ContentRow
                        label="Word Count"
                        value={content.wordCount}
                        tooltip="Total visible textual content extracted from the page. Low word count may indicate thin or low-value content."
                    />
                    <ContentRow
                        label="Text-to-HTML Ratio"
                        value={content.textRatio ? `${(content.textRatio * 100).toFixed(1)}%` : 'N/A'}
                        tooltip="Ratio of text content to HTML code size. Higher is generally better for crawl efficiency."
                    />
                    <ContentRow
                        label="Image Count"
                        value={content.imageCount ?? 'N/A'}
                        tooltip="Number of <img> tags found on the page."
                    />
                    <ContentRow
                        label="Missing Alt Text"
                        value={content.missingAlt ?? 'N/A'}
                        status={content.missingAlt && content.missingAlt > 0 ? 'warning' : 'good'}
                        tooltip="Number of images missing the 'alt' attribute, which is important for accessibility and image SEO."
                    />
                </div>
            </div>
        </div>
    );
};

const ContentRow = ({ label, value, meta, status, tooltip }: { label: string, value: string | number, meta?: string, status?: 'good' | 'warning', tooltip: string }) => (
    <div className="group">
        <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
            <div className="relative cursor-help">
                <HelpCircle size={12} className="text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    <div className="font-bold mb-1">{label}</div>
                    <div className="opacity-90 leading-relaxed">{tooltip}</div>
                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                </div>
            </div>
        </div>
        <div className="flex items-baseline gap-3">
            <div className={`text-base font-semibold ${status === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-200'} break-words`}>
                {value}
            </div>
            {meta && <div className="text-xs font-mono text-slate-400">{meta}</div>}
        </div>
    </div>
);
