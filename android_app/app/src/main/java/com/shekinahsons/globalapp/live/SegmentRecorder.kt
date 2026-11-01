package com.shekinahsons.globalapp.live

import android.media.MediaFormat
import com.pedro.common.AudioCodec
import com.pedro.common.VideoCodec
import com.pedro.common.frame.MediaFrame
import com.pedro.common.isKeyframe
import com.pedro.common.toMediaCodecBufferInfo
import com.pedro.library.base.recording.AsyncBaseRecordController
import com.pedro.library.base.recording.RecordController
import com.pedro.srt.mpeg2ts.MpegTsPacket
import com.pedro.srt.mpeg2ts.MpegTsPacketizer
import com.pedro.srt.mpeg2ts.MpegType
import com.pedro.srt.mpeg2ts.packets.AacPacket
import com.pedro.srt.mpeg2ts.packets.H264Packet
import com.pedro.srt.mpeg2ts.psi.Psi
import com.pedro.srt.mpeg2ts.psi.PsiManager
import com.pedro.srt.mpeg2ts.service.Mpeg2TsService
import com.pedro.srt.srt.packets.data.PacketPosition
import com.pedro.srt.utils.chunkPackets
import com.pedro.srt.utils.toCodec
import java.io.File
import java.io.FileDescriptor
import java.io.FileOutputStream

// Uses RootEncoder's existing H.264/AAC packetizers. The single recording
// coroutine rotates only before a keyframe, so no encoded frames are discarded
// when switching files and every segment is independently decodable.
class SegmentRecorder(private val directory: File, private val complete: (File, Double) -> Unit) : AsyncBaseRecordController() {
    private val service = Mpeg2TsService()
    private val psi = PsiManager(service)
    private val packetizer = MpegTsPacketizer(psi)
    private val video = H264Packet(1316, psi)
    private val audio = AacPacket(1316, psi)
    private var output: FileOutputStream? = null
    private var file: File? = null
    private var sequence = 0
    private var started = -1L
    private var latest = 0L
    private var asked = false
    private var hasVideo = false
    override fun startRecordImp(path: String, listener: RecordController.Listener?, tracks: RecordController.RecordTracks) {
        require(getVideoCodec() == VideoCodec.H264 && getAudioCodec() == AudioCodec.AAC) { "Broadcast requires H.264/AAC" }
        directory.mkdirs()
        sequence = 0; started = -1; hasVideo = false
        service.clear(); service.addTrack(AudioCodec.AAC.toCodec()); service.addTrack(VideoCodec.H264.toCodec()); service.generatePmt(); psi.updateService(service)
        rotate()
    }
    override fun startRecordImp(fd: FileDescriptor, listener: RecordController.Listener?, tracks: RecordController.RecordTracks) { error("A recording folder is required") }
    private fun write(packets: List<MpegTsPacket>) { packets.forEach { output?.write(it.buffer) } }
    private fun tables() {
        val tables = mutableListOf<Psi>(psi.getPat()); psi.getPmt()?.let { tables.add(it) }; tables.add(psi.getSdt())
        packetizer.write(tables).chunkPackets(7).forEach { output?.write(it) }
    }
    private fun rotate() {
        file = File(directory, "%06d.ts".format(sequence++)); output = FileOutputStream(file!!); tables(); asked = false
    }
    private fun finish(end: Long) {
        output?.fd?.sync(); output?.close(); output = null
        val f = file
        if (f != null && hasVideo && f.length() > 376 && started >= 0 && end > started) complete(f, (end - started) / 1_000_000.0)
        else f?.delete()
        file = null
    }
    override suspend fun onWriteFrame(frame: MediaFrame) {
        val timestamp = frame.info.timestamp
        if (frame.type == MediaFrame.Type.VIDEO) {
            val key = frame.info.toMediaCodecBufferInfo().isKeyframe()
            if (!hasVideo && !key) return
            if (started < 0) { started = timestamp; hasVideo = true; recordStatus = RecordController.Status.RECORDING; listener?.onStatusChange(recordStatus) }
            if (key && timestamp - started >= 900_000) {
                finish(timestamp); rotate(); started = timestamp
            } else if (!asked && timestamp - started >= 1_100_000) { asked = true; myRequestKeyFrame?.onRequestKeyFrame() }
            video.createAndSendPacket(frame) { write(psi.checkSendInfo(key, packetizer, 7)); write(it) }
        } else if (hasVideo) audio.createAndSendPacket(frame) { write(it) }
        latest = maxOf(latest, timestamp)
    }
    override fun stopRecordImp() { finish(latest + 33_333); packetizer.reset(); psi.reset(); video.reset(false); audio.reset(false) }
    override fun setVideoFormat(format: MediaFormat) {
        val sps = format.getByteBuffer("csd-0") ?: return
        val pps = format.getByteBuffer("csd-1") ?: return
        video.sendVideoInfo(sps.duplicate(), pps.duplicate())
    }
    override fun setAudioFormat(format: MediaFormat) { audio.sendAudioInfo(format.getInteger(MediaFormat.KEY_SAMPLE_RATE), format.getInteger(MediaFormat.KEY_CHANNEL_COUNT) > 1, AudioCodec.AAC) }
    override fun resetFormats() {}
}
