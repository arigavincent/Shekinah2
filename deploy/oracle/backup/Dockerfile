FROM alpine:3.22
RUN apk add --no-cache postgresql17-client rclone tzdata bash gzip
COPY backup.sh /usr/local/bin/backup.sh
COPY run.sh /usr/local/bin/run.sh
RUN chmod 755 /usr/local/bin/backup.sh /usr/local/bin/run.sh
ENTRYPOINT ["/usr/local/bin/run.sh"]
