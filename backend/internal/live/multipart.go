package live

import (
	"context"
	"fmt"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"io"
	"os"
	"time"
)

// Long services can exceed R2's single-PUT limit. Multipart keeps memory bounded
// and aborts incomplete uploads, while the archive queue retains the source.
func (s *archiveStore) upload(ctx context.Context, file *os.File, key string, size int64) error {
	if size <= 64*1024*1024 {
		_, err := s.client.PutObject(ctx, &s3.PutObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key), ContentType: aws.String("application/octet-stream"), ContentLength: aws.Int64(size), Body: file})
		return err
	}
	return s.multipart(ctx, file, key, size, 64*1024*1024)
}
func (s *archiveStore) multipart(ctx context.Context, reader io.ReaderAt, key string, size, partSize int64) (err error) {
	started, err := s.client.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{Bucket: aws.String(s.bucket), Key: aws.String(key), ContentType: aws.String("application/octet-stream")})
	if err != nil {
		return err
	}
	if started.UploadId == nil {
		return fmt.Errorf("storage did not return an upload ID")
	}
	complete := false
	defer func() {
		if !complete {
			cleanup, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			_, _ = s.client.AbortMultipartUpload(cleanup, &s3.AbortMultipartUploadInput{Bucket: aws.String(s.bucket), Key: aws.String(key), UploadId: started.UploadId})
		}
	}()
	parts := []types.CompletedPart{}
	for offset := int64(0); offset < size; offset += partSize {
		n := int32(len(parts) + 1)
		length := min(partSize, size-offset)
		result, err := s.client.UploadPart(ctx, &s3.UploadPartInput{Bucket: aws.String(s.bucket), Key: aws.String(key), UploadId: started.UploadId, PartNumber: aws.Int32(n), Body: io.NewSectionReader(reader, offset, length), ContentLength: aws.Int64(length)})
		if err != nil {
			return err
		}
		parts = append(parts, types.CompletedPart{ETag: result.ETag, PartNumber: aws.Int32(n)})
	}
	_, err = s.client.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{Bucket: aws.String(s.bucket), Key: aws.String(key), UploadId: started.UploadId, MultipartUpload: &types.CompletedMultipartUpload{Parts: parts}})
	complete = err == nil
	return err
}
