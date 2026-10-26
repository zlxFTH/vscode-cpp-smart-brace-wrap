__global__ void kernel(int *data);
void demo(int t, int *data) {
    while (t--)
        kernel<<<1, 32>>>(data);
}
