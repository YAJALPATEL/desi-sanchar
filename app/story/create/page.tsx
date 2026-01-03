'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
    X, Image as ImageIcon, Type, Send, Loader2, Trash2, Pipette, Check
} from 'lucide-react'
import { createClient } from '@/app/lib/supabase'

const GRADIENTS = [
    "from-indigo-500 via-purple-500 to-pink-500",
    "from-red-500 via-orange-500 to-yellow-500",
    "from-green-400 via-emerald-500 to-teal-500",
    "from-gray-900 via-gray-800 to-black",
    "from-blue-600 via-blue-400 to-cyan-300"
]

// Stylish Preset Colors
const TEXT_COLORS = [
    '#FFFFFF', '#000000', '#EF4444', '#F97316', '#FACC15', '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'
]

export default function CreateStoryPage() {
    const router = useRouter()
    const supabase = createClient()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    // Refs needed for eyedropper functionality
    const imageRef = useRef<HTMLImageElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // === MEDIA STATES ===
    const [mediaFile, setMediaFile] = useState<File | null>(null)
    const [mediaPreview, setMediaPreview] = useState<string | null>(null)
    const [mediaType, setMediaType] = useState<'image' | 'video' | 'text'>('text')
    const [textBg, setTextBg] = useState(GRADIENTS[0])
    const [duration, setDuration] = useState(10)

    // === STICKER STATES ===
    const [stickers, setStickers] = useState<any[]>([])
    const [draggingId, setDraggingId] = useState<number | null>(null)
    const [dragStartPos, setDragStartPos] = useState<{ x: number, y: number } | null>(null)
    const [isOverTrash, setIsOverTrash] = useState(false)

    // === UI STATES ===
    const [showTextInput, setShowTextInput] = useState(false)
    const [inputValue, setInputValue] = useState("")
    const [selectedColor, setSelectedColor] = useState('#FFFFFF')
    // New state for eyedropper mode
    const [isEyedropperActive, setIsEyedropperActive] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [isPosting, setIsPosting] = useState(false)

    // Handle File Selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            const type = file.type.startsWith('video') ? 'video' : 'image'
            setMediaFile(file)
            setMediaPreview(URL.createObjectURL(file))
            setMediaType(type)
            if (type === 'video') setDuration(60)
            else setDuration(10)
        }
    }

    // === EYEDROPPER LOGIC (The magic part) ===
    const handleEyedropperPick = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isEyedropperActive || !containerRef.current || !canvasRef.current || mediaType !== 'image' || !imageRef.current) return;

        // 1. Get click coordinates relative to container
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        // 2. Set canvas size to match displayed container size
        canvas.width = rect.width;
        canvas.height = rect.height;

        // 3. Draw the image onto the canvas stretched to fit (simulating object-fit: cover for pixel picking)
        // Note: This is an approximation. For perfect precision with object-fit: cover, complex math is needed, 
        // but drawing stretched usually works well enough for UI color picking.
        ctx.drawImage(imageRef.current, 0, 0, rect.width, rect.height);

        // 4. Get pixel data at click location
        const pixelData = ctx.getImageData(x, y, 1, 1).data;
        // Convert RGBA to HEX
        const hex = `#${[pixelData[0], pixelData[1], pixelData[2]].map(c => c.toString(16).padStart(2, '0')).join('')}`;

        setSelectedColor(hex.toUpperCase());
        setIsEyedropperActive(false); // Exit mode
    };


    // === DRAG & DELETE LOGIC ===
    const handleDragStart = (id: number, e: React.TouchEvent | React.MouseEvent) => {
        e.stopPropagation()
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

        setDraggingId(id)
        setDragStartPos({ x: clientX, y: clientY })
        setIsOverTrash(false)
    }

    const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (draggingId === null || !containerRef.current) return

        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

        const rect = containerRef.current.getBoundingClientRect()
        const x = ((clientX - rect.left) / rect.width) * 100
        const y = ((clientY - rect.top) / rect.height) * 100

        if (y > 85) setIsOverTrash(true)
        else setIsOverTrash(false)

        setStickers(prev => prev.map(s => s.id === draggingId ? { ...s, x, y } : s))
    }

    const handleDragEnd = (e: React.TouchEvent | React.MouseEvent) => {
        if (draggingId === null) return

        // Delete Action
        if (isOverTrash) {
            setStickers(prev => prev.filter(s => s.id !== draggingId))
            setDraggingId(null)
            setIsOverTrash(false)
            return
        }

        // Tap to Edit Action
        const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as React.MouseEvent).clientX
        const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.MouseEvent).clientY

        if (dragStartPos) {
            const moveDistance = Math.sqrt(Math.pow(clientX - dragStartPos.x, 2) + Math.pow(clientY - dragStartPos.y, 2))

            if (moveDistance < 5) {
                const stickerToEdit = stickers.find(s => s.id === draggingId)
                if (stickerToEdit) {
                    setInputValue(stickerToEdit.content)
                    setSelectedColor(stickerToEdit.color || '#FFFFFF')
                    setEditingId(draggingId)
                    setShowTextInput(true)
                }
            }
        }

        setDraggingId(null)
        setDragStartPos(null)
    }

    // === TEXT STICKER SAVE ===
    const handleSaveText = () => {
        if (!inputValue.trim()) {
            if (editingId) setStickers(prev => prev.filter(s => s.id !== editingId))
            setShowTextInput(false)
            return
        }

        if (editingId) {
            setStickers(prev => prev.map(s => s.id === editingId ? { ...s, content: inputValue, color: selectedColor } : s))
        } else {
            setStickers([...stickers, { id: Date.now(), type: 'text', content: inputValue, color: selectedColor, x: 50, y: 50 }])
        }

        setInputValue("")
        setEditingId(null)
        setSelectedColor('#FFFFFF')
        setShowTextInput(false)
    }

    const handlePostStory = async () => {
        setIsPosting(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            let mediaUrl = null
            if (mediaFile) {
                const ext = mediaFile.name.split('.').pop()
                const fileName = `story-${user.id}-${Date.now()}.${ext}`
                const { error } = await supabase.storage.from('post_images').upload(fileName, mediaFile)
                if (error) throw error
                const { data } = supabase.storage.from('post_images').getPublicUrl(fileName)
                mediaUrl = data.publicUrl
            }

            const { error: dbError } = await supabase.from('stories').insert({
                user_id: user.id,
                media_url: mediaUrl,
                media_type: mediaType,
                content: mediaType === 'text' ? inputValue : null,
                duration: duration,
                stickers: { stickers, background: mediaType === 'text' ? textBg : null }
            })

            if (dbError) throw dbError
            router.push('/')
            router.refresh()

        } catch (error: any) {
            alert("Error: " + error.message)
        } finally {
            setIsPosting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center select-none">

            <div className="w-full h-full md:w-[450px] md:h-[90vh] md:rounded-[2rem] bg-black relative overflow-hidden shadow-2xl border border-white/10 flex flex-col">

                {/* HEADER */}
                {/* Hide header if eyedropper is active so user sees full image */}
                {!isEyedropperActive && (
                    <div className="absolute top-0 left-0 right-0 p-4 pt-6 z-20 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent transition-opacity">
                        <button onClick={() => router.back()} className="text-white p-2 bg-black/20 rounded-full backdrop-blur-md"><X size={24} /></button>
                        <button onClick={() => { setInputValue(""); setEditingId(null); setSelectedColor("#FFFFFF"); setShowTextInput(true); }} className="p-2 bg-black/30 text-white rounded-full backdrop-blur-md"><Type size={20} /></button>
                    </div>
                )}

                {/* HIDDEN CANVAS FOR EYEDROPPER */}
                <canvas ref={canvasRef} className="hidden"></canvas>

                {/* CANVAS */}
                <div
                    ref={containerRef}
                    className={`flex-1 relative overflow-hidden flex items-center justify-center ${mediaType === 'text' ? `bg-gradient-to-br ${textBg}` : 'bg-black'}`}
                    // Eyedropper click handlers
                    onClick={handleEyedropperPick}
                    onTouchStart={isEyedropperActive ? handleEyedropperPick : undefined}
                    // Normal drag handlers (only if not eyedropping)
                    onTouchMove={!isEyedropperActive ? handleDragMove : undefined}
                    onMouseMove={!isEyedropperActive ? handleDragMove : undefined}
                    onTouchEnd={!isEyedropperActive ? handleDragEnd : undefined}
                    onMouseUp={!isEyedropperActive ? handleDragEnd : undefined}
                >
                    {/* Image needs ref and must not have pointer-events-none so click registers */}
                    {mediaType === 'image' && mediaPreview && <Image ref={imageRef} src={mediaPreview} alt="Story" fill className={`object-cover ${isEyedropperActive ? '' : 'pointer-events-none'}`} unoptimized crossOrigin="anonymous" />}
                    {mediaType === 'video' && mediaPreview && <video src={mediaPreview} className="w-full h-full object-cover pointer-events-none" autoPlay loop muted playsInline />}

                    {mediaType === 'text' && stickers.length === 0 && <div className="text-white/50 text-2xl font-bold animate-pulse pointer-events-none">Tap "Aa" to type</div>}

                    {/* Stickers (Hidden during eyedropper mode) */}
                    {!isEyedropperActive && stickers.map((s) => (
                        <div
                            key={s.id}
                            onMouseDown={(e) => handleDragStart(s.id, e)}
                            onTouchStart={(e) => handleDragStart(s.id, e)}
                            className={`absolute z-10 px-4 py-2 rounded-xl font-bold text-center min-w-[50px] cursor-move text-3xl drop-shadow-lg transition-transform ${draggingId === s.id ? 'scale-110 opacity-80' : ''}`}
                            style={{ top: `${s.y}%`, left: `${s.x}%`, transform: 'translate(-50%, -50%)', userSelect: 'none', color: s.color || '#FFFFFF' }}
                        >
                            <div className="leading-tight break-words pointer-events-none">{s.content}</div>
                        </div>
                    ))}

                    {/* Eyedropper Cursor Hint */}
                    {isEyedropperActive && (
                        <div className="absolute top-8 bg-black/60 text-white px-4 py-2 rounded-full font-bold text-sm animate-in slide-in-from-top pointer-events-none z-50">
                            Tap image to pick color
                        </div>
                    )}

                    {/* Delete Zone */}
                    {draggingId !== null && !isEyedropperActive && (
                        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 flex flex-col items-center gap-2 ${isOverTrash ? 'scale-125' : 'scale-100'}`}>
                            <div className={`p-4 rounded-full border-2 transition-colors ${isOverTrash ? 'bg-red-500 border-red-500 text-white' : 'bg-black/40 border-white/30 text-white/70'}`}><Trash2 size={28} /></div>
                            {isOverTrash && <span className="text-red-500 font-bold text-xs bg-black/50 px-2 py-1 rounded-md">Release to Delete</span>}
                        </div>
                    )}
                </div>

                {/* BOTTOM CONTROLS (Hide during eyedropper) */}
                {!isEyedropperActive && (
                    <div className={`bg-black relative flex flex-col px-6 pb-8 pt-4 z-20 transition-transform duration-300 ${draggingId !== null ? 'translate-y-full opacity-50' : 'translate-y-0 opacity-100'}`}>
                        {mediaType !== 'video' && (<div className="flex justify-center gap-3 mb-6">{[10, 30, 60].map(s => (<button key={s} onClick={() => setDuration(s)} className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${duration === s ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>{s}s</button>))}</div>)}
                        <div className="flex items-center justify-between">
                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*" />
                            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"><div className="w-10 h-10 border-2 border-white/30 rounded-lg flex items-center justify-center overflow-hidden">{mediaPreview ? <Image src={mediaPreview} width={40} height={40} alt="min" className="object-cover w-full h-full" /> : <ImageIcon size={20} />}</div><span className="text-[10px] font-bold">Gallery</span></button>
                            <button onClick={handlePostStory} disabled={isPosting || (mediaType === 'text' && stickers.length === 0)} className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center -mt-10 shadow-xl bg-crimson disabled:opacity-50 active:scale-95 transition-all">{isPosting ? <Loader2 className="animate-spin text-white" size={28} /> : <Send size={28} className="text-white ml-1" />}</button>
                            {mediaType === 'text' ? (<button onClick={() => setTextBg(GRADIENTS[(GRADIENTS.indexOf(textBg) + 1) % GRADIENTS.length])} className="flex flex-col items-center gap-1 text-white/80"><div className={`w-10 h-10 rounded-full bg-gradient-to-br ${textBg} border-2 border-white/50`} /><span className="text-[10px] font-bold">Color</span></button>) : <div className="w-10" />}
                        </div>
                    </div>
                )}

                {/* INPUT MODAL WITH COLOR PICKER */}
                {showTextInput && (
                    <div className={`absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 transition-opacity duration-300 ${isEyedropperActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                        <input
                            autoFocus={!isEyedropperActive}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Type something..."
                            style={{ color: selectedColor }}
                            className="w-full bg-transparent text-3xl font-bold text-center outline-none placeholder-white/30 mb-8"
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveText()}
                        />

                        {/* COLOR PALETTE & EYEDROPPER */}
                        <div className="flex items-center gap-3 mb-8 overflow-x-auto max-w-full p-2 no-scrollbar">
                            {/* Eyedropper Button - Only show if image is selected */}
                            {mediaType === 'image' && (
                                <button onClick={() => setIsEyedropperActive(true)} className="w-10 h-10 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                                    <Pipette size={20} />
                                </button>
                            )}
                            {/* Preset Colors */}
                            {TEXT_COLORS.map(c => (
                                <button key={c} onClick={() => setSelectedColor(c)} className={`w-8 h-8 rounded-full border-[3px] transition-all ${selectedColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent scale-100'}`} style={{ backgroundColor: c, boxShadow: selectedColor === c ? `0 0 10px ${c}` : 'none' }} />
                            ))}
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => { setShowTextInput(false); setEditingId(null); setInputValue(""); }} className="px-6 py-2 rounded-full border border-white/30 text-white font-bold">Cancel</button>
                            <button onClick={handleSaveText} className="px-8 py-2 rounded-full bg-white text-black font-bold">{editingId ? 'Update' : 'Done'}</button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}